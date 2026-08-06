// JSON-RPC bridge between the Python test suite and the current Puppeteer.
// Protocol: one JSON object per line on stdin (requests) and stdout (responses).
// Everything else (logs) goes to stderr so stdout stays a clean channel.
import { createInterface } from "node:readline";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import puppeteer, { customQueryHandlers } from "puppeteer";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_DIAGNOSTICS = 200;

const log = (...args) => console.error("[bridge]", ...args);

// Resolves a chain of [css, nth|null] steps. Runs inside the page, so it must
// be self-contained. Each step searches below the previous step's matches.
function resolveChain(chain, root) {
  let roots = [root || document];
  for (const [css, nth] of chain) {
    let found = [];
    for (const r of roots) {
      found.push(...r.querySelectorAll(css));
    }
    found = [...new Set(found)];
    if (nth !== null && nth !== undefined) {
      const element = found.at(nth);
      found = element ? [element] : [];
    }
    roots = found;
  }
  return roots;
}

// Lets nth/within scoping reuse Locators' auto-waiting via "scope/<json>".
const resolverSource = resolveChain.toString();
customQueryHandlers.register("scope", {
  queryAll: new Function("root", "selector", `return (${resolverSource})(JSON.parse(selector), root);`),
  queryOne: new Function("root", "selector", `return (${resolverSource})(JSON.parse(selector), root)[0] || null;`),
});

function toSelector(chain) {
  if (!Array.isArray(chain) || chain.length === 0) {
    throw new Error("Invalid selector chain");
  }
  if (chain.length === 1 && (chain[0][1] === null || chain[0][1] === undefined)) {
    return chain[0][0];
  }
  return `scope/${JSON.stringify(chain)}`;
}

// A function expression string plus JSON args, run without eval in Node.
const callExpression = (script, args) => `(${script})(...${JSON.stringify(args ?? [])})`;

let browser = null;
let nextId = 1;
const contexts = new Map();
const pages = new Map();
const diagnostics = new Map();

function getPage(params) {
  const page = pages.get(params.page);
  if (!page) throw new Error(`Unknown page: ${params.page}`);
  return page;
}

function record(pageId, entry) {
  const list = diagnostics.get(pageId);
  if (!list) return;
  list.push({ time: Date.now(), ...entry });
  if (list.length > MAX_DIAGNOSTICS) list.shift();
}

function locatorFor(page, params, { visible = true } = {}) {
  let locator = page
    .locator(toSelector(params.chain))
    .setTimeout(params.timeout ?? DEFAULT_TIMEOUT_MS);
  if (!visible) locator = locator.setVisibility(null);
  return locator.setEnsureElementIsInTheViewport(true);
}

// Waits for the element (without requiring visibility) and runs fn on it.
async function withElement(page, params, fn, ...args) {
  const handle = await locatorFor(page, params, { visible: false }).waitHandle();
  try {
    return await handle.evaluate(fn, ...args);
  } finally {
    await handle.dispose();
  }
}

async function clearStorage(page) {
  await page.evaluate(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (window.indexedDB?.databases) {
      const databases = await window.indexedDB.databases();
      await Promise.all(
        databases.map(
          (db) =>
            new Promise((resolve) => {
              const request = window.indexedDB.deleteDatabase(db.name);
              request.onsuccess = request.onerror = request.onblocked = () => resolve();
            }),
        ),
      );
    }
  });
}

const methods = {
  async "browser.launch"({ headless = true, executablePath, args = [], viewport }) {
    if (browser) throw new Error("Browser already launched");
    const launchArgs = [...args];
    // Chrome's sandbox cannot start for the CI user on Linux runners.
    if (process.env.CI) launchArgs.push("--no-sandbox");
    // Proxy auto-detection (WPAD) stalls every navigation 20-30 s on some machines; the SUT is direct.
    if (!process.env.USE_SYSTEM_PROXY && !launchArgs.some((a) => a.startsWith("--proxy-server"))) {
      launchArgs.push("--no-proxy-server");
    }
    const options = {
      headless,
      args: launchArgs,
      defaultViewport: viewport ?? { width: 1280, height: 800 },
    };
    const executable = executablePath || process.env.PUPPETEER_EXECUTABLE_PATH;
    if (executable) options.executablePath = executable;
    else options.channel = "chrome";
    browser = await puppeteer.launch(options);
    return { version: await browser.version() };
  },

  async "browser.close"() {
    if (browser) {
      const closing = browser;
      browser = null;
      await closing.close();
    }
    return null;
  },

  async "context.new"() {
    if (!browser) throw new Error("Browser is not launched");
    const context = await browser.createBrowserContext();
    const id = `ctx${nextId++}`;
    contexts.set(id, context);
    return { context: id };
  },

  async "context.close"({ context }) {
    const ctx = contexts.get(context);
    if (!ctx) return null;
    contexts.delete(context);
    for (const [id, page] of pages) {
      if (page.browserContext() === ctx) {
        pages.delete(id);
        diagnostics.delete(id);
      }
    }
    await ctx.close();
    return null;
  },

  async "page.new"({ context }) {
    const ctx = contexts.get(context);
    if (!ctx) throw new Error(`Unknown context: ${context}`);
    const page = await ctx.newPage();
    const id = `page${nextId++}`;
    pages.set(id, page);
    diagnostics.set(id, []);
    page.on("console", (message) => {
      if (["error", "warn", "warning"].includes(message.type())) {
        record(id, { kind: `console.${message.type()}`, text: message.text() });
      }
    });
    page.on("pageerror", (error) => record(id, { kind: "pageerror", text: String(error?.message ?? error) }));
    page.on("requestfailed", (request) =>
      record(id, { kind: "requestfailed", text: `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}` }),
    );
    return { page: id };
  },

  async "page.goto"(params) {
    const response = await getPage(params).goto(params.url, {
      waitUntil: "domcontentloaded",
      timeout: params.timeout ?? 30_000,
    });
    return { status: response?.status() ?? null };
  },

  async "page.reload"(params) {
    await getPage(params).reload({ waitUntil: "domcontentloaded", timeout: params.timeout ?? 30_000 });
    return null;
  },

  async "page.url"(params) {
    return getPage(params).url();
  },

  async "page.title"(params) {
    return getPage(params).title();
  },

  async "page.setViewport"(params) {
    await getPage(params).setViewport({ width: params.width, height: params.height });
    return null;
  },

  async "page.evaluate"(params) {
    return getPage(params).evaluate(callExpression(params.script, params.args));
  },

  async "page.addInitScript"(params) {
    await getPage(params).evaluateOnNewDocument(callExpression(params.script, params.args));
    return null;
  },

  async "page.clearStorage"(params) {
    await clearStorage(getPage(params));
    return null;
  },

  async "page.clearCookies"(params) {
    const context = getPage(params).browserContext();
    const cookies = await context.cookies();
    if (cookies.length) await context.deleteCookie(...cookies);
    return null;
  },

  async "page.cookies"(params) {
    return getPage(params).browserContext().cookies();
  },

  async "page.pressKey"(params) {
    await getPage(params).keyboard.press(params.key);
    return null;
  },

  async "page.screenshot"(params) {
    mkdirSync(dirname(params.path), { recursive: true });
    await getPage(params).screenshot({ path: params.path, fullPage: params.fullPage ?? true });
    return null;
  },

  async "page.diagnostics"(params) {
    const list = diagnostics.get(params.page) ?? [];
    const copy = [...list];
    if (params.clear) list.length = 0;
    return copy;
  },

  async "page.close"(params) {
    const page = getPage(params);
    pages.delete(params.page);
    diagnostics.delete(params.page);
    await page.close();
    return null;
  },

  async "element.click"(params) {
    await locatorFor(getPage(params), params).click();
    return null;
  },

  async "element.fill"(params) {
    const page = getPage(params);
    const locator = locatorFor(page, params);
    if (params.value === "") {
      // Locator.fill with an empty string does not clear, so select and delete.
      await locator.click();
      await withElement(page, params, (el) => el.select());
      await page.keyboard.press("Backspace");
      return null;
    }
    await locator.fill(params.value);
    return null;
  },

  async "element.type"(params) {
    const page = getPage(params);
    await locatorFor(page, params).click();
    await page.keyboard.type(params.text, { delay: params.delay ?? 0 });
    return null;
  },

  async "element.press"(params) {
    const page = getPage(params);
    await locatorFor(page, params).click();
    await page.keyboard.press(params.key);
    return null;
  },

  async "element.hover"(params) {
    await locatorFor(getPage(params), params).hover();
    return null;
  },

  async "element.scrollIntoView"(params) {
    await withElement(getPage(params), params, (el) => el.scrollIntoView({ block: "center" }));
    return null;
  },

  async "element.text"(params) {
    return withElement(getPage(params), params, (el) => el.textContent ?? "");
  },

  async "element.value"(params) {
    return withElement(getPage(params), params, (el) => el.value ?? "");
  },

  async "element.attribute"(params) {
    return withElement(getPage(params), params, (el, name) => el.getAttribute(name), params.name);
  },

  async "element.property"(params) {
    return withElement(getPage(params), params, (el, name) => el[name], params.name);
  },

  async "element.count"(params) {
    const handles = await getPage(params).$$(toSelector(params.chain));
    await Promise.all(handles.map((handle) => handle.dispose()));
    return handles.length;
  },

  async "element.isVisible"(params) {
    const handle = await getPage(params).$(toSelector(params.chain));
    if (!handle) return false;
    try {
      return await handle.isVisible();
    } finally {
      await handle.dispose();
    }
  },

  async "element.isEnabled"(params) {
    const handle = await getPage(params).$(toSelector(params.chain));
    if (!handle) return false;
    try {
      return await handle.evaluate((el) => !el.matches(":disabled"));
    } finally {
      await handle.dispose();
    }
  },

  async "element.waitFor"(params) {
    const page = getPage(params);
    const timeout = params.timeout ?? DEFAULT_TIMEOUT_MS;
    const selector = toSelector(params.chain);
    switch (params.state) {
      case "visible":
        (await page.waitForSelector(selector, { visible: true, timeout })).dispose();
        break;
      case "hidden":
        await page.waitForSelector(selector, { hidden: true, timeout });
        break;
      case "attached":
        (await page.waitForSelector(selector, { timeout })).dispose();
        break;
      case "detached":
        await page.waitForFunction(
          `(${resolverSource})(${JSON.stringify(params.chain)}).length === 0`,
          { timeout },
        );
        break;
      default:
        throw new Error(`Unknown wait state: ${params.state}`);
    }
    return null;
  },
};

function errorPayload(error) {
  const timedOut = error?.name === "TimeoutError";
  return { code: timedOut ? "timeout" : "error", message: String(error?.message ?? error) };
}

async function handle(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    log("Ignoring malformed line:", line.slice(0, 200));
    return;
  }
  const { id, method, params } = request;
  try {
    const fn = methods[method];
    if (!fn) throw new Error(`Unknown method: ${method}`);
    const result = await fn(params ?? {});
    send({ id, result: result ?? null });
  } catch (error) {
    send({ id, error: errorPayload(error) });
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const pending = new Set();
const reader = createInterface({ input: process.stdin });
reader.on("line", (line) => {
  if (!line.trim()) return;
  const task = handle(line).finally(() => pending.delete(task));
  pending.add(task);
});
// Python closing our stdin (or dying) is the shutdown signal.
reader.on("close", async () => {
  await Promise.allSettled(pending);
  try {
    await methods["browser.close"]();
  } finally {
    process.exit(0);
  }
});

log("ready", `node ${process.version}`);
send({ id: 0, result: { ready: true } });
