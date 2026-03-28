FROM node:alpine AS node-builder

WORKDIR /backend

COPY package*.json .
RUN npm install

COPY . .
RUN npm run build

FROM registry.heroiclabs.com/heroiclabs/nakama:3.38.0

# rollup outputs to modules/index.js in repository
COPY --from=node-builder /backend/modules/*.js /nakama/data/modules/
COPY local.yml /nakama/data/

ENTRYPOINT ["/bin/sh", "-ecx", \
  "/nakama/nakama migrate up --database.address $NAKAMA_DATABASE_ADDRESS && \
  exec /nakama/nakama \
  --name nakama1 \
  --config /nakama/data/local.yml \
  --database.address $NAKAMA_DATABASE_ADDRESS \
  --logger.level INFO \
  --session.token_expiry_sec 7200"]