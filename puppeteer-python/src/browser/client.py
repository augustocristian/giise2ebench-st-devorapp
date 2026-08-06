"""Asyncio JSON-RPC client for the Node bridge (bridge/server.mjs)."""
import asyncio
import json
import logging
import os
import shutil
from collections import deque
from pathlib import Path
from typing import Any

from src.browser.errors import (
    BridgeCrashedError,
    BridgeProtocolError,
    BridgeTimeoutError,
    BrowserError,
    ElementTimeoutError,
)

log = logging.getLogger(__name__)

BRIDGE_SCRIPT = Path(__file__).resolve().parent.parent.parent / "bridge" / "server.mjs"
# Replies can carry big evaluate results, far above asyncio's 64 KiB default.
_STREAM_LIMIT = 32 * 1024 * 1024
_STDERR_LINES_KEPT = 100
# Extra time on top of Puppeteer's own timeout before we give up on the bridge.
_DEADLINE_MARGIN_S = 15.0


class BridgeClient:
    def __init__(self, node_binary: str | None = None, script: Path = BRIDGE_SCRIPT) -> None:
        self._node = node_binary or os.environ.get("NODE_BINARY") or shutil.which("node")
        self._script = script
        self._process: asyncio.subprocess.Process | None = None
        self._pending: dict[int, asyncio.Future[Any]] = {}
        self._next_id = 1
        self._stderr: deque[str] = deque(maxlen=_STDERR_LINES_KEPT)
        self._tasks: list[asyncio.Task[None]] = []
        self._closing = False

    @property
    def stderr_tail(self) -> str:
        return "\n".join(self._stderr)

    async def start(self) -> None:
        if self._node is None:
            raise BrowserError("Node.js was not found; install Node >= 22.12 or set NODE_BINARY")
        if not (self._script.parent / "node_modules").is_dir():
            raise BrowserError(
                f"Bridge dependencies missing: run 'PUPPETEER_SKIP_DOWNLOAD=true npm ci' in {self._script.parent}"
            )
        # ELECTRON_RUN_AS_NODE leaks in from VS Code terminals and breaks plain node.
        env = {k: v for k, v in os.environ.items() if k != "ELECTRON_RUN_AS_NODE"}
        self._process = await asyncio.create_subprocess_exec(
            self._node, str(self._script),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            limit=_STREAM_LIMIT,
            env=env,
        )
        self._tasks = [
            asyncio.create_task(self._read_stdout()),
            asyncio.create_task(self._read_stderr()),
        ]
        await self._wait_ready()

    async def _wait_ready(self) -> None:
        # The bridge announces itself with a response of id 0.
        future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        self._pending[0] = future
        try:
            await asyncio.wait_for(future, 30.0)
        except asyncio.TimeoutError as exc:
            await self.close()
            raise BridgeTimeoutError("The bridge did not start within 30 s") from exc

    async def request(self, method: str, params: dict[str, Any] | None = None, timeout: float = 60.0) -> Any:
        process = self._process
        if process is None or process.stdin is None or process.returncode is not None:
            raise BridgeCrashedError(f"The bridge is not running.\n{self.stderr_tail}")
        request_id = self._next_id
        self._next_id += 1
        future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        self._pending[request_id] = future
        line = json.dumps({"id": request_id, "method": method, "params": params or {}}) + "\n"
        try:
            process.stdin.write(line.encode("utf-8"))
            await process.stdin.drain()
            return await asyncio.wait_for(future, timeout)
        except asyncio.TimeoutError as exc:
            raise BridgeTimeoutError(f"No answer to '{method}' within {timeout:.0f} s") from exc
        except (BrokenPipeError, ConnectionResetError) as exc:
            raise BridgeCrashedError(f"The bridge pipe is closed.\n{self.stderr_tail}") from exc
        finally:
            self._pending.pop(request_id, None)

    @staticmethod
    def deadline(timeout_ms: int | None) -> float:
        """Client-side deadline for an operation that has a Puppeteer timeout."""
        return (timeout_ms or 30_000) / 1000.0 + _DEADLINE_MARGIN_S

    async def close(self) -> None:
        self._closing = True
        process = self._process
        if process is not None and process.returncode is None:
            if process.stdin is not None:
                process.stdin.close()  # EOF makes the bridge close Chrome and exit
            try:
                await asyncio.wait_for(process.wait(), 20.0)
            except asyncio.TimeoutError:
                log.warning("Bridge did not exit in time, terminating it")
                process.terminate()
                await process.wait()
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks = []
        self._process = None
        self._fail_pending(BridgeCrashedError("The bridge was closed"))

    # ── Internals ────────────────────────────────────────────────────────────

    async def _read_stdout(self) -> None:
        process = self._process
        assert process is not None and process.stdout is not None
        while True:
            raw = await process.stdout.readline()
            if not raw:
                break
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                log.warning("Non-JSON line from the bridge: %.200s", raw)
                continue
            future = self._pending.get(message.get("id"))
            if future is None or future.done():
                continue
            error = message.get("error")
            if error is None:
                future.set_result(message.get("result"))
            elif error.get("code") == "timeout":
                future.set_exception(ElementTimeoutError(error.get("message", "")))
            else:
                future.set_exception(BridgeProtocolError(error.get("message", "")))
        if not self._closing:
            await process.wait()
            self._fail_pending(BridgeCrashedError(
                f"The bridge exited with code {process.returncode}.\n{self.stderr_tail}"))

    async def _read_stderr(self) -> None:
        process = self._process
        assert process is not None and process.stderr is not None
        async for raw in process.stderr:
            text = raw.decode("utf-8", errors="replace").rstrip()
            self._stderr.append(text)
            log.debug("bridge: %s", text)

    def _fail_pending(self, error: Exception) -> None:
        for future in self._pending.values():
            if not future.done():
                future.set_exception(error)
        self._pending.clear()
