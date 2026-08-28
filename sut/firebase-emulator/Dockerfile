# Firebase Local Emulator Suite (Auth + Firestore) for dev/E2E.
# trixie is used because it ships the OpenJDK 21 the Firestore emulator needs.
FROM node:22-trixie-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        default-jre-headless ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g --no-fund --no-audit firebase-tools@15.35.0

# Create a non-privileged user and configure workdir
RUN useradd -u 10001 -m appuser
WORKDIR /app
RUN chown appuser:appuser /app
USER appuser

ENV FIREBASE_PROJECT=epi-devorapp \
    CI=true \
    FIREBASE_TELEMETRY_COLLECTION_ENABLED=false

COPY --chown=appuser:appuser firebase.json ./firebase.json

# Fetch the Firestore emulator jar at build time.
RUN firebase setup:emulators:firestore

EXPOSE 9099 8080

HEALTHCHECK --interval=5s --timeout=3s --retries=12 --start-period=15s \
    CMD node -e "Promise.all(['9099','8080'].map(p=>fetch('http://127.0.0.1:'+p+'/'))).then(()=>process.exit(0),()=>process.exit(1))"

CMD ["sh", "-c", "firebase emulators:start --only auth,firestore --project $FIREBASE_PROJECT"]
