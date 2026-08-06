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
  return import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
};

export const getApiUrl = (): string => {
  return getBaseUrl();
};
