# Abgleich-Server für „Nix wie weg“ – keine Fremdpakete, nur Node.js
FROM node:22-alpine
WORKDIR /app
# Werkzeug für Offline-Karten (statisch gebaut, läuft auch auf Alpine)
ARG PMTILES_VERSION=1.31.2
ARG TARGETARCH
RUN case "$TARGETARCH" in arm64) a=arm64 ;; *) a=x86_64 ;; esac \
 && wget -qO- "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_${a}.tar.gz" \
  | tar -xz -C /usr/local/bin pmtiles
COPY package.json *.mjs ./
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production \
    NWW_DATA=/data \
    PORT=8787
VOLUME ["/data"]
EXPOSE 8787
USER node
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "--no-warnings", "server.mjs"]
