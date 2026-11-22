// Google/API settings. At runtime the container writes them to /env-config.js
// (window.__ENV__, see docker/40-env-config.sh), so one image serves dev and prod.
// Falls back to the build-time VITE_* variables (vite dev server, Android build).
interface RuntimeEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_API_KEY?: string;
  API_URL?: string;
}

const runtime = (): RuntimeEnv => (window as unknown as { __ENV__?: RuntimeEnv }).__ENV__ ?? {};

export const env = {
  get googleClientId(): string {
    return runtime().GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  },
  get googleApiKey(): string {
    return runtime().GOOGLE_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';
  },
  get apiUrl(): string {
    return runtime().API_URL || import.meta.env.VITE_API_URL || '';
  },
};
