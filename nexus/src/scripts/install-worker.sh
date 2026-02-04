#!/bin/bash
set -e

NEXUS_URL="${NEXUS_URL:-http://localhost:3002}"
API_KEY="${1}"

if [ -z "$API_KEY" ]; then
  echo "Uso: curl -fsSL $NEXUS_URL/install.sh | bash -s -- <API_KEY>"
  exit 1
fi

echo "Instalando/Actualizando Ultimate Terminal Worker..."

if [ -f /etc/debian_version ]; then
  echo "Descargando worker .deb..."
  curl -fL "${NEXUS_URL}/api/downloads/latest/worker-linux.deb" -o /tmp/worker.deb
  echo "Instalando..."
  sudo dpkg -i /tmp/worker.deb || sudo apt-get install -f -y
elif [ -f /etc/redhat-release ] || [ -f /etc/centos-release ] || [ -f /etc/fedora-release ]; then
  echo "Descargando worker .rpm..."
  curl -fL "${NEXUS_URL}/api/downloads/latest/worker-linux.rpm" -o /tmp/worker.rpm
  echo "Instalando..."
  sudo rpm -Uvh /tmp/worker.rpm
else
  echo "Distribucion no soportada automaticamente. Usa el binario o paquete manualmente."
  exit 1
fi

CONFIG_FILE="/etc/ultimate-terminal/worker.env"
sudo mkdir -p /etc/ultimate-terminal

if grep -q "NEXUS_URL=" "${CONFIG_FILE}" 2>/dev/null; then
  sudo sed -i "s|^NEXUS_URL=.*|NEXUS_URL=${NEXUS_URL}|" "${CONFIG_FILE}"
else
  echo "NEXUS_URL=${NEXUS_URL}" | sudo tee -a "${CONFIG_FILE}" >/dev/null
fi

if grep -q "API_KEY=" "${CONFIG_FILE}" 2>/dev/null; then
  sudo sed -i "s|^API_KEY=.*|API_KEY=${API_KEY}|" "${CONFIG_FILE}"
else
  echo "API_KEY=${API_KEY}" | sudo tee -a "${CONFIG_FILE}" >/dev/null
fi

echo "Reiniciando servicio..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart ultimate-terminal-worker || true
fi

echo "Listo: worker configurado."
