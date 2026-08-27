#!/usr/bin/env bash
# 飞牛 NAS / Linux：安装 lexiforest curl-impersonate 到 /usr/local
# Docker 镜像已内置，一般不必在 NAS 主机再装。
set -euo pipefail
VER="${CURL_IMPERSONATE_VERSION:-v2.1.1}"
case "$(uname -m)" in
  x86_64|amd64) ARCH=x86_64-linux-gnu ;;
  aarch64|arm64) ARCH=aarch64-linux-gnu ;;
  *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac
URL="https://github.com/lexiforest/curl-impersonate/releases/download/${VER}/curl-impersonate-${VER}.${ARCH}.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Download $URL"
curl -fsSL -o "$TMP/ci.tgz" "$URL"
mkdir -p "$TMP/out"
tar -xzf "$TMP/ci.tgz" -C "$TMP/out"
sudo install -d /usr/local/bin /usr/local/lib
find "$TMP/out" -type f -name 'curl-impersonate' -exec sudo install -m 755 {} /usr/local/bin/ \;
find "$TMP/out" -type f -name 'curl_chrome*' -exec sudo install -m 755 {} /usr/local/bin/ \;
find "$TMP/out" -type f \( -name 'libcurl*.so*' -o -name '*.so' \) -exec sudo install -m 755 {} /usr/local/lib/ \;
echo /usr/local/lib | sudo tee /etc/ld.so.conf.d/curl-impersonate.conf >/dev/null
sudo ldconfig
echo "SCRAPE_CURL_BIN=/usr/local/bin/curl-impersonate"
echo "SCRAPE_CURL_IMPERSONATE=chrome136"
/usr/local/bin/curl-impersonate --impersonate chrome136 --version | head -n 3
