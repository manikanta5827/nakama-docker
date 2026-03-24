FROM node:alpine AS node-builder

WORKDIR /backend

COPY package*.json .
RUN npm install

COPY . .
RUN npm run build

FROM registry.heroiclabs.com/heroiclabs/nakama:3.38.0

COPY --from=node-builder /backend/build/*.js /nakama/data/modules/
COPY local.yml /nakama/data/