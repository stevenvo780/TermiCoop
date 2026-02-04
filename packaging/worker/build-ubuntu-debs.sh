#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${ROOT_DIR}/dist/packages"
PKG_CACHE_DIR="${ROOT_DIR}/dist/pkg-cache"
WORKER_VERSION="$(node -p "require('${ROOT_DIR}/worker/package.json').version")"

NODE_MAJOR="${NODE_MAJOR:-20}"
PKG_TARGET="${PKG_TARGET:-node20-linux-x64}"

UBUNTU_VERSIONS=("$@")
if [ ${#UBUNTU_VERSIONS[@]} -eq 0 ]; then
  UBUNTU_VERSIONS=(20.04 22.04 24.04)
fi

mkdir -p "${OUT_DIR}" "${PKG_CACHE_DIR}"

for UBUNTU_VERSION in "${UBUNTU_VERSIONS[@]}"; do
  case "${UBUNTU_VERSION}" in
    20.04) GLIBC_MIN="2.31" ;;
    22.04) GLIBC_MIN="2.35" ;;
    24.04) GLIBC_MIN="2.39" ;;
    *) GLIBC_MIN="2.31" ;;
  esac

  echo "==============================================="
  echo "[Ubuntu ${UBUNTU_VERSION}] Build worker .deb"
  echo "Node: ${NODE_MAJOR} | PKG target: ${PKG_TARGET} | GLIBC >= ${GLIBC_MIN}"
  echo "==============================================="

  docker run --rm \
    -e "DEBIAN_FRONTEND=noninteractive" \
    -e "UBUNTU_VERSION=${UBUNTU_VERSION}" \
    -e "NODE_MAJOR=${NODE_MAJOR}" \
    -e "PKG_TARGET=${PKG_TARGET}" \
    -e "WORKER_VERSION=${WORKER_VERSION}" \
    -e "GLIBC_MIN=${GLIBC_MIN}" \
    -v "${ROOT_DIR}:/workspace:ro" \
    -v "${OUT_DIR}:/out" \
    -v "${PKG_CACHE_DIR}:/pkg-cache" \
    "ubuntu:${UBUNTU_VERSION}" \
    bash -lc '
      set -euo pipefail

      APT_OPTS="-o Acquire::Retries=3 -o Acquire::ForceIPv4=true -o Acquire::http::Timeout=20"

      export PKG_CACHE_PATH=/pkg-cache

      sed -i "s|http://security.ubuntu.com/ubuntu|http://archive.ubuntu.com/ubuntu|g" /etc/apt/sources.list
      apt-get ${APT_OPTS} update
      apt-get ${APT_OPTS} install -y --no-install-recommends \
        ca-certificates curl python3 make g++ gcc git dpkg-dev xz-utils

      NODE_VERSION="${NODE_VERSION:-}"
      if [ -z "${NODE_VERSION}" ]; then
        NODE_VERSION="20.11.1"
        if curl -fsSL https://nodejs.org/dist/index.json -o /tmp/node-index.json; then
          NODE_VERSION="$(python3 - <<'"'"'PY'"'"'
import json
import os

major = os.environ.get("NODE_MAJOR", "20")
with open("/tmp/node-index.json", "r", encoding="utf-8") as f:
    data = json.load(f)
for entry in data:
    version = entry.get("version", "").lstrip("v")
    if version.startswith(f"{major}."):
        print(version)
        break
PY
          )"
        fi
      fi
      if [ -z "${NODE_VERSION}" ]; then
        echo "ERROR: No se pudo resolver NODE_VERSION para major ${NODE_MAJOR}"
        exit 1
      fi
      curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o /tmp/node.tar.xz
      tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1

      mkdir -p /tmp/worker
      cp -r /workspace/worker/* /tmp/worker/
      cd /tmp/worker

      npm install
      npm run build
      npx @yao-pkg/pkg . --targets "${PKG_TARGET}" --output /tmp/ultimate-terminal-worker

      npm rebuild node-pty --build-from-source
      PTY_SRC="/tmp/worker/node_modules/node-pty/build/Release/pty.node"
      if [ ! -f "${PTY_SRC}" ]; then
        echo "ERROR: node-pty build not found at ${PTY_SRC}"
        exit 1
      fi

      PKGROOT="/tmp/pkgroot"
      rm -rf "${PKGROOT}"
      mkdir -p "${PKGROOT}/DEBIAN"
      mkdir -p "${PKGROOT}/usr/bin"
      mkdir -p "${PKGROOT}/usr/lib/systemd/system"
      mkdir -p "${PKGROOT}/usr/lib/ultimate-terminal/prebuilds/linux-x64"
      mkdir -p "${PKGROOT}/etc/ultimate-terminal"

      cp /tmp/ultimate-terminal-worker "${PKGROOT}/usr/bin/ultimate-terminal-worker"
      cp /workspace/packaging/worker/systemd/ultimate-terminal-worker.service "${PKGROOT}/usr/lib/systemd/system/"
      cp "${PTY_SRC}" "${PKGROOT}/usr/lib/ultimate-terminal/prebuilds/linux-x64/pty.node"

      cp /workspace/packaging/worker/debian/postinst "${PKGROOT}/DEBIAN/postinst"
      cp /workspace/packaging/worker/debian/prerm "${PKGROOT}/DEBIAN/prerm"
      cp /workspace/packaging/worker/debian/postrm "${PKGROOT}/DEBIAN/postrm"
      chmod 755 "${PKGROOT}/DEBIAN/postinst" "${PKGROOT}/DEBIAN/prerm" "${PKGROOT}/DEBIAN/postrm"

      sed \
        -e "s/^Version:.*/Version: ${WORKER_VERSION}/" \
        -e "s/^Architecture:.*/Architecture: amd64/" \
        -e "s/^Depends:.*/Depends: libc6 (>= ${GLIBC_MIN})/" \
        /workspace/packaging/worker/debian/control > "${PKGROOT}/DEBIAN/control"

      OUTPUT="/out/ultimate-terminal-worker_${WORKER_VERSION}_ubuntu${UBUNTU_VERSION}_amd64_x86_64.deb"
      dpkg-deb --build "${PKGROOT}" "${OUTPUT}"

      echo "OK: ${OUTPUT}"
    '
done

echo "All packages in: ${OUT_DIR}"
