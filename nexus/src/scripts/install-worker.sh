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
  apt_fix() {
    echo "Resolviendo dependencias..."
    if $SUDO apt-get update -y && $SUDO apt-get install -f -y; then
      return 0
    fi

    echo "Reintentando con IPv4 + mirror alterno..."
    APT_OPTS="-o Acquire::Retries=3 -o Acquire::ForceIPv4=true -o Acquire::http::Timeout=20"
    if [ -f /etc/apt/sources.list ]; then
      if echo "$OS_ID" | grep -Eq '^(ubuntu|linuxmint|pop|kali)$'; then
        $SUDO sed -i \
          -e 's|http://security.ubuntu.com/ubuntu|http://archive.ubuntu.com/ubuntu|g' \
          -e 's|https://security.ubuntu.com/ubuntu|http://archive.ubuntu.com/ubuntu|g' \
          /etc/apt/sources.list || true
      fi
    fi
    $SUDO apt-get $APT_OPTS update -y || true
    $SUDO apt-get $APT_OPTS install -f -y
  }

  local tmp_deb
  tmp_deb="$(mktemp /tmp/worker.XXXXXX.deb)"
  echo "Descargando worker .deb..."
  curl -fL "${NEXUS_URL}/api/downloads/latest/worker-linux.deb?os=${OS_ID}&version=${VERSION_ID}&arch=${ARCH_RAW}" -o "${tmp_deb}"
  echo "Instalando..."
  $SUDO dpkg -i "${tmp_deb}" || apt_fix
  rm -f "${tmp_deb}" || true
}

install_rpm() {
  local tmp_rpm
  tmp_rpm="$(mktemp /tmp/worker.XXXXXX.rpm)"
  echo "Descargando worker .rpm..."
  curl -fL "${NEXUS_URL}/api/downloads/latest/worker-linux.rpm?os=${OS_ID}&version=${VERSION_ID}&arch=${ARCH_RAW}" -o "${tmp_rpm}"
  echo "Instalando..."
  $SUDO rpm -Uvh "${tmp_rpm}" || $SUDO rpm -Uvh --oldpackage --replacepkgs "${tmp_rpm}"
  rm -f "${tmp_rpm}" || true
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
  if command -v timeout >/dev/null 2>&1; then
    rc=0
    timeout 2 /usr/bin/ultimate-terminal-worker --help >/dev/null 2>&1 || rc=$?
    if [ "$rc" -eq 124 ]; then
      rc=0
    fi
  else
    rc=0
    /usr/bin/ultimate-terminal-worker --help >/dev/null 2>&1 || rc=$?
  fi
  if [ "$rc" -ne 0 ]; then
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
