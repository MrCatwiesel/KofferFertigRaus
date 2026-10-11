# Abgleich-Server für „Nix wie weg“ – keine Fremdpakete, nur Node.js
FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs piwigo.mjs ./
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production \
    NWW_DATA=/data \
    PORT=8787
VOLUME ["/data"]
EXPOSE 8787
USER node
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "--no-warnings", "server.mjs"]
