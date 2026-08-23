# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm install --prefix apps/server && npm install --prefix apps/web
COPY apps/server apps/server
COPY apps/web apps/web
COPY config config
RUN npm run build --prefix apps/web

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9210
ENV HOST=0.0.0.0
ENV MDCS_WEB_DIST=/app/apps/web/dist
COPY --from=build /app/apps/server /app/apps/server
COPY --from=build /app/apps/web/dist /app/apps/web/dist
COPY --from=build /app/config /app/config
WORKDIR /app/apps/server
RUN npm install --omit=dev
EXPOSE 9210
CMD ["npx", "tsx", "src/index.ts"]
