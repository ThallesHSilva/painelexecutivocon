FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8000 \
    DATABASE_PATH=/var/lib/mapa-parque/mapa-parque.sqlite \
    UPLOAD_PATH=/var/lib/mapa-parque/uploads

WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/scripts ./scripts

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/mapa-parque/uploads \
    && chown -R node:node /var/lib/mapa-parque

USER node
VOLUME ["/var/lib/mapa-parque"]
EXPOSE 8000

CMD ["node", ".output/server/index.mjs"]
