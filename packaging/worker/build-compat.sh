#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE_NAME="ut-worker-build-compat"

echo "[CompatBuild] Building Docker image..."
docker build -f "${ROOT_DIR}/packaging/worker/Dockerfile.build" -t "${IMAGE_NAME}" "${ROOT_DIR}"

echo "[CompatBuild] Building worker binary (Node 18, Ubuntu 20.04)..."
docker run --rm \
  -v "${ROOT_DIR}:/workspace" \
  -w /workspace/worker \
  "${IMAGE_NAME}" \
  bash -lc "npm ci && npm run build && npx @yao-pkg/pkg . --targets node18-linux-x64 --output bin/worker-linux"

echo "[CompatBuild] OK: worker/bin/worker-linux"
