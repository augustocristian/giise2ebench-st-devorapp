import { env } from '../../config/env';
// Intercept global fetch to skip Ngrok browser warning page automatically
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const targetUrl = typeof input === 'string' 
    ? input 
    : (input instanceof Request ? input.url : input.toString());

  if (targetUrl.includes('ngrok-free')) {
    if (input instanceof Request) {
      try {
        input.headers.set('ngrok-skip-browser-warning', 'true');
      } catch (e) {
        const clonedRequest = new Request(input);
        clonedRequest.headers.set('ngrok-skip-browser-warning', 'true');
        return originalFetch(clonedRequest, init);
      }
    } else {
      init = init || {};
      if (init.headers instanceof Headers) {
        init.headers.set('ngrok-skip-browser-warning', 'true');
      } else if (Array.isArray(init.headers)) {
        init.headers.push(['ngrok-skip-browser-warning', 'true']);
      } else if (init.headers) {
        init.headers = {
          ...init.headers,
          'ngrok-skip-browser-warning': 'true'
        };
      } else {
        init.headers = {
          'ngrok-skip-browser-warning': 'true'
        };
      }
    }
  }
  return originalFetch(input, init);
};

const getBaseUrl = (): string => {
  const customUrl = localStorage.getItem('CUSTOM_API_URL');
  if (customUrl) {
    return customUrl;
  }
  return env.apiUrl || `${window.location.origin}/api/v1`;
};

export const getApiUrl = (): string => {
  return getBaseUrl();
};

const PAGE_SIZE = 100;

/**
 * Fetches every page of a paginated collection ({items,total,limit,offset})
 * and returns all the items as a single array.
 * `makeError` builds the Error to throw when a page answers with a non-2xx status.
 */
export const fetchAllPages = async <T = any>(
  url: string,
  makeError: (response: Response) => Promise<Error> | Error
): Promise<T[]> => {
  const all: T[] = [];
  let offset = 0;
  const separator = url.includes('?') ? '&' : '?';
  for (;;) {
    const response = await fetch(`${url}${separator}limit=${PAGE_SIZE}&offset=${offset}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      throw await makeError(response);
    }
    const page = await response.json();
    const items: T[] = page.items ?? [];
    all.push(...items);
    if (items.length === 0 || offset + PAGE_SIZE >= (page.total ?? 0)) break;
    offset += PAGE_SIZE;
  }
  return all;
};
