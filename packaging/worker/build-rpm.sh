#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${ROOT_DIR}/dist/packages"
PKG_CACHE_DIR="${ROOT_DIR}/dist/pkg-cache"
WORKER_VERSION="$(node -p "require('${ROOT_DIR}/worker/package.json').version")"

NODE_MAJOR="${NODE_MAJOR:-20}"
PKG_TARGET="${PKG_TARGET:-node20-linux-x64}"

RPM_VARIANTS=("$@")
if [ ${#RPM_VARIANTS[@]} -eq 0 ]; then
  RPM_VARIANTS=(
    rhel9 rhel8
    rocky9 rocky8
    alma9 alma8
    centos7 centos8
    fedora42 fedora41 fedora40 fedora39
  )
fi

mkdir -p "${OUT_DIR}" "${PKG_CACHE_DIR}"

echo "==============================================="
echo "[RPM] Build worker package (Rocky Linux 8)"
echo "Node: ${NODE_MAJOR} | PKG target: ${PKG_TARGET}"
echo "==============================================="

docker run --rm \
  -e "NODE_MAJOR=${NODE_MAJOR}" \
  -e "PKG_TARGET=${PKG_TARGET}" \
  -e "WORKER_VERSION=${WORKER_VERSION}" \
  -v "${ROOT_DIR}:/workspace:ro" \
  -v "${OUT_DIR}:/out" \
  -v "${PKG_CACHE_DIR}:/pkg-cache" \
  rockylinux:8 \
  bash -lc '
    set -euo pipefail

    export PKG_CACHE_PATH=/pkg-cache

    dnf -y install \
      curl tar xz git python3 make gcc gcc-c++ rpm-build findutils

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

    RPMROOT="/tmp/rpmbuild"
    rm -rf "${RPMROOT}"
    mkdir -p "${RPMROOT}/"{BUILD,RPMS,SOURCES,SPECS,SRPMS}

    cp /tmp/ultimate-terminal-worker "${RPMROOT}/SOURCES/ultimate-terminal-worker"
    cp /workspace/packaging/worker/systemd/ultimate-terminal-worker.service "${RPMROOT}/SOURCES/ultimate-terminal-worker.service"
    mkdir -p "${RPMROOT}/SOURCES/prebuilds/linux-x64"
    cp "${PTY_SRC}" "${RPMROOT}/SOURCES/prebuilds/linux-x64/pty.node"

    sed \
      -e "s/^Version:.*/Version: ${WORKER_VERSION}/" \
      -e "s/^Release:.*/Release: 1/" \
      /workspace/packaging/worker/rpm/ultimate-terminal-worker.spec > "${RPMROOT}/SPECS/ultimate-terminal-worker.spec"

    rpmbuild --define "_topdir ${RPMROOT}" -bb "${RPMROOT}/SPECS/ultimate-terminal-worker.spec"

    BASE_OUT="/out/ultimate-terminal-worker_${WORKER_VERSION}_rpm_base_x86_64.rpm"
    cp "${RPMROOT}/RPMS/x86_64/"*.rpm "${BASE_OUT}"
    echo "OK: ${BASE_OUT}"
  '

BASE_RPM="${OUT_DIR}/ultimate-terminal-worker_${WORKER_VERSION}_rpm_base_x86_64.rpm"
if [ ! -f "${BASE_RPM}" ]; then
  echo "ERROR: No se generó el RPM base."
  exit 1
fi

for variant in "${RPM_VARIANTS[@]}"; do
  target="${OUT_DIR}/ultimate-terminal-worker_${WORKER_VERSION}_${variant}_x86_64.rpm"
  cp "${BASE_RPM}" "${target}"
  echo "OK: ${target}"
done

echo "All packages in: ${OUT_DIR}"
