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
# lexiforest curl-impersonate：带 cf_clearance 时 TLS 对齐 Chrome（飞牛 NAS / Docker）
ENV CURL_IMPERSONATE_VERSION=v2.1.1
ENV SCRAPE_CURL_BIN=/usr/local/bin/curl-impersonate
ENV SCRAPE_CURL_IMPERSONATE=chrome136
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tar \
  && arch="$(dpkg --print-architecture)" \
  && case "$arch" in \
       amd64) ci_arch=x86_64-linux-gnu ;; \
       arm64) ci_arch=aarch64-linux-gnu ;; \
       *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
     esac \
  && curl -fsSL -o /tmp/curl-impersonate.tar.gz \
       "https://github.com/lexiforest/curl-impersonate/releases/download/${CURL_IMPERSONATE_VERSION}/curl-impersonate-${CURL_IMPERSONATE_VERSION}.${ci_arch}.tar.gz" \
  && mkdir -p /tmp/curl-impersonate \
  && tar -xzf /tmp/curl-impersonate.tar.gz -C /tmp/curl-impersonate \
  && find /tmp/curl-impersonate -type f -name 'curl-impersonate' -exec install -m 755 {} /usr/local/bin/ \; \
  && find /tmp/curl-impersonate -type f -name 'curl_chrome*' -exec install -m 755 {} /usr/local/bin/ \; \
  && find /tmp/curl-impersonate -type f \( -name 'libcurl*.so*' -o -name '*.so' \) -exec install -m 755 {} /usr/local/lib/ \; \
  && echo "/usr/local/lib" > /etc/ld.so.conf.d/curl-impersonate.conf \
  && ldconfig \
  && rm -rf /tmp/curl-impersonate /tmp/curl-impersonate.tar.gz \
  && apt-get purge -y --auto-remove tar \
  && rm -rf /var/lib/apt/lists/* \
  && /usr/local/bin/curl-impersonate --impersonate chrome136 --version | head -n 1
COPY --from=build /app/apps/server /app/apps/server
COPY --from=build /app/apps/web/dist /app/apps/web/dist
COPY --from=build /app/config /app/config
WORKDIR /app/apps/server
RUN npm install --omit=dev
EXPOSE 9210
CMD ["npx", "tsx", "src/index.ts"]
