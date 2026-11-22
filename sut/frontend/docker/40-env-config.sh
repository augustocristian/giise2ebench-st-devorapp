#!/bin/sh
# Writes env-config.js from the container environment (read by src/config/env.ts).
# Values are API keys / URLs: they must not contain double quotes or backslashes.
cat > /usr/share/nginx/html/env-config.js <<JS
window.__ENV__ = {
  GOOGLE_CLIENT_ID: "${VITE_GOOGLE_CLIENT_ID}",
  GOOGLE_API_KEY: "${VITE_GOOGLE_API_KEY}",
  API_URL: "${VITE_API_URL}"
};
JS
