#!/bin/bash
set -e

NEXUS_URL="${NEXUS_URL:-http://localhost:3002}"
API_KEY="${1}"

if [ -z "$API_KEY" ]; then
  echo "Uso: curl -fsSL $NEXUS_URL/install.sh | bash -s -- <API_KEY>"
  exit 1
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "Error: se requiere sudo para instalar paquetes."
    exit 1
  fi
fi

OS_ID="unknown"
VERSION_ID="unknown"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  VERSION_ID="${VERSION_ID:-unknown}"
fi
ARCH_RAW="$(uname -m || echo unknown)"

echo "Instalando/Actualizando Ultimate Terminal Worker..."
echo "Sistema detectado: $OS_ID $VERSION_ID ($ARCH_RAW)"

install_deb() {
  echo "Descargando worker .deb..."
  curl -fL "${NEXUS_URL}/api/downloads/latest/worker-linux.deb?os=${OS_ID}&version=${VERSION_ID}&arch=${ARCH_RAW}" -o /tmp/worker.deb
  echo "Instalando..."
  $SUDO dpkg -i /tmp/worker.deb || $SUDO apt-get install -f -y
}

install_rpm() {
  echo "Descargando worker .rpm..."
  curl -fL "${NEXUS_URL}/api/downloads/latest/worker-linux.rpm?os=${OS_ID}&version=${VERSION_ID}&arch=${ARCH_RAW}" -o /tmp/worker.rpm
  echo "Instalando..."
  $SUDO rpm -Uvh /tmp/worker.rpm
}

case "$OS_ID" in
  ubuntu|debian|linuxmint|pop|kali)
    install_deb
    ;;
  fedora|rhel|centos|rocky|alma)
    install_rpm
    ;;
  arch|manjaro|endeavouros)
    echo "Arch Linux detectado."
    echo "No hay paquete oficial disponible. Usa el binario manual o compila desde fuente."
    exit 1
    ;;
  *)
    if [ -f /etc/debian_version ]; then
      install_deb
    elif [ -f /etc/redhat-release ] || [ -f /etc/centos-release ] || [ -f /etc/fedora-release ]; then
      install_rpm
    else
      echo "Distribucion no soportada automaticamente. Usa el binario o paquete manualmente."
      exit 1
    fi
    ;;
esac

CONFIG_FILE="/etc/ultimate-terminal/worker.env"
$SUDO mkdir -p /etc/ultimate-terminal

if grep -q "NEXUS_URL=" "${CONFIG_FILE}" 2>/dev/null; then
  $SUDO sed -i "s|^NEXUS_URL=.*|NEXUS_URL=${NEXUS_URL}|" "${CONFIG_FILE}"
else
  echo "NEXUS_URL=${NEXUS_URL}" | $SUDO tee -a "${CONFIG_FILE}" >/dev/null
fi

if grep -q "API_KEY=" "${CONFIG_FILE}" 2>/dev/null; then
  $SUDO sed -i "s|^API_KEY=.*|API_KEY=${API_KEY}|" "${CONFIG_FILE}"
else
  echo "API_KEY=${API_KEY}" | $SUDO tee -a "${CONFIG_FILE}" >/dev/null
fi

if [ -n "${WORKER_NAME:-}" ]; then
  if grep -q "WORKER_NAME=" "${CONFIG_FILE}" 2>/dev/null; then
    $SUDO sed -i "s|^WORKER_NAME=.*|WORKER_NAME=${WORKER_NAME}|" "${CONFIG_FILE}"
  else
    echo "WORKER_NAME=${WORKER_NAME}" | $SUDO tee -a "${CONFIG_FILE}" >/dev/null
  fi
fi

if [ -x /usr/bin/ultimate-terminal-worker ]; then
  if ! /usr/bin/ultimate-terminal-worker --help >/dev/null 2>&1; then
    echo "ERROR: El binario no ejecuta correctamente (posible incompatibilidad GLIBC)."
    echo "Recomendado: compilar el worker en Ubuntu 20.04 con Node 18 y reempaquetar."
    exit 1
  fi
fi

if command -v systemctl >/dev/null 2>&1 && [ "$(ps -p 1 -o comm=)" = "systemd" ]; then
  echo "Reiniciando servicio..."
  $SUDO systemctl restart ultimate-terminal-worker || true
  echo "Listo: worker configurado."
else
  echo "systemd no detectado. Inicia el worker manualmente:"
  echo "  NEXUS_URL=${NEXUS_URL} API_KEY=${API_KEY} /usr/bin/ultimate-terminal-worker"
fi
