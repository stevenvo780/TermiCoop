import express from 'express';
import cors from 'cors';
import path from 'path';
import fs, { existsSync } from 'fs';
import authRoutes from './routes/auth.routes';
import workerRoutes from './routes/worker.routes';

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = clientOrigin.split(',').map((o) => o.trim());
const corsOrigin = allowedOrigins.includes('*') ? '*' : allowedOrigins;

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);

const downloadRoots = [
  path.resolve(process.cwd(), 'dist/packages'),
  path.resolve(process.cwd(), '../dist/packages'),
  '/usr/share/ultimate-terminal/downloads'
];

const installScriptPaths = [
  path.join(__dirname, 'scripts/install-worker.sh'),
  path.resolve(process.cwd(), 'nexus/src/scripts/install-worker.sh'),
  path.resolve(process.cwd(), 'src/scripts/install-worker.sh')
];

const defaultNexusUrl = process.env.NEXUS_PUBLIC_URL || process.env.NEXUS_URL || 'http://localhost:3002';

const INSTALL_SCRIPT_FALLBACK = `#!/bin/bash
set -e

NEXUS_URL=\"\${NEXUS_URL:-${defaultNexusUrl}}\"
API_KEY=\"\${1}\"

if [ -z \"\${API_KEY}\" ]; then
  echo \"Uso: curl -fsSL \$NEXUS_URL/install.sh | bash -s -- <API_KEY>\"
  exit 1
fi

SUDO=\"\"
if [ \"\$(id -u)\" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO=\"sudo\"
  else
    echo \"Error: se requiere sudo para instalar paquetes.\"
    exit 1
  fi
fi

OS_ID=\"unknown\"
VERSION_ID=\"unknown\"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID=\"\${ID:-unknown}\"
  VERSION_ID=\"\${VERSION_ID:-unknown}\"
fi
ARCH_RAW=\"\$(uname -m || echo unknown)\"

echo \"Instalando/Actualizando Ultimate Terminal Worker...\"
echo \"Sistema detectado: \${OS_ID} \${VERSION_ID} (\${ARCH_RAW})\"

install_deb() {
  echo \"Descargando worker .deb...\"
  curl -fL \"\${NEXUS_URL}/api/downloads/latest/worker-linux.deb?os=\${OS_ID}&version=\${VERSION_ID}&arch=\${ARCH_RAW}\" -o /tmp/worker.deb
  echo \"Instalando...\"
  \${SUDO} dpkg -i /tmp/worker.deb || \${SUDO} apt-get install -f -y
}

install_rpm() {
  echo \"Descargando worker .rpm...\"
  curl -fL \"\${NEXUS_URL}/api/downloads/latest/worker-linux.rpm?os=\${OS_ID}&version=\${VERSION_ID}&arch=\${ARCH_RAW}\" -o /tmp/worker.rpm
  echo \"Instalando...\"
  \${SUDO} rpm -Uvh /tmp/worker.rpm
}

case \"\${OS_ID}\" in
  ubuntu|debian|linuxmint|pop|kali)
    install_deb
    ;;
  fedora|rhel|centos|rocky|alma)
    install_rpm
    ;;
  arch|manjaro|endeavouros)
    echo \"Arch Linux detectado.\"
    echo \"No hay paquete oficial disponible. Usa el binario manual o compila desde fuente.\"
    exit 1
    ;;
  *)
    if [ -f /etc/debian_version ]; then
      install_deb
    elif [ -f /etc/redhat-release ] || [ -f /etc/centos-release ] || [ -f /etc/fedora-release ]; then
      install_rpm
    else
      echo \"Distribucion no soportada automaticamente. Usa el binario o paquete manualmente.\"
      exit 1
    fi
    ;;
esac

CONFIG_FILE=\"/etc/ultimate-terminal/worker.env\"
\${SUDO} mkdir -p /etc/ultimate-terminal
if grep -q \"NEXUS_URL=\" \"\${CONFIG_FILE}\" 2>/dev/null; then
  \${SUDO} sed -i \"s|^NEXUS_URL=.*|NEXUS_URL=\${NEXUS_URL}|\" \"\${CONFIG_FILE}\"
else
  echo \"NEXUS_URL=\${NEXUS_URL}\" | \${SUDO} tee -a \"\${CONFIG_FILE}\" >/dev/null
fi
if grep -q \"API_KEY=\" \"\${CONFIG_FILE}\" 2>/dev/null; then
  \${SUDO} sed -i \"s|^API_KEY=.*|API_KEY=\${API_KEY}|\" \"\${CONFIG_FILE}\"
else
  echo \"API_KEY=\${API_KEY}\" | \${SUDO} tee -a \"\${CONFIG_FILE}\" >/dev/null
fi

if [ -n \"\${WORKER_NAME:-}\" ]; then
  if grep -q \"WORKER_NAME=\" \"\${CONFIG_FILE}\" 2>/dev/null; then
    \${SUDO} sed -i \"s|^WORKER_NAME=.*|WORKER_NAME=\${WORKER_NAME}|\" \"\${CONFIG_FILE}\"
  else
    echo \"WORKER_NAME=\${WORKER_NAME}\" | \${SUDO} tee -a \"\${CONFIG_FILE}\" >/dev/null
  fi
fi

if [ -x /usr/bin/ultimate-terminal-worker ]; then
  if ! /usr/bin/ultimate-terminal-worker --help >/dev/null 2>&1; then
    echo \"ERROR: El binario no ejecuta correctamente (posible incompatibilidad GLIBC).\"
    echo \"Recomendado: compilar el worker en Ubuntu 20.04 con Node 18 y reempaquetar.\"
    exit 1
  fi
fi

if command -v systemctl >/dev/null 2>&1 && [ \"\$(ps -p 1 -o comm=)\" = \"systemd\" ]; then
  echo \"Reiniciando servicio...\"
  \${SUDO} systemctl restart ultimate-terminal-worker || true
  echo \"Listo: worker configurado.\"
else
  echo \"systemd no detectado. Inicia el worker manualmente:\"
  echo \"  NEXUS_URL=\${NEXUS_URL} API_KEY=\${API_KEY} /usr/bin/ultimate-terminal-worker\"
fi
`;

app.get('/install.sh', (req, res) => {
  const filePath = installScriptPaths.find(p => existsSync(p));
  if (filePath) {
    res.type('text/x-shellscript').send(fs.readFileSync(filePath, 'utf-8'));
    return;
  }
  res.type('text/x-shellscript').send(INSTALL_SCRIPT_FALLBACK);
});

app.get('/api/downloads/latest/worker-linux.:ext', (req, res) => {
  const { ext } = req.params;
  const os = typeof req.query.os === 'string' ? req.query.os : '';
  const version = typeof req.query.version === 'string' ? req.query.version : '';
  const arch = typeof req.query.arch === 'string' ? req.query.arch : '';
  const allowed = ext === 'deb' || ext === 'rpm';
  if (!allowed) {
    res.status(400).send('Formato no soportado. Usa .deb o .rpm');
    return;
  }

  const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const osKey = normalizeToken(os);
  const versionKey = normalizeToken(version);
  const versionCompact = versionKey.replace(/[^0-9]+/g, '');
  const archKey = normalizeToken(arch);

  const candidates = downloadRoots.flatMap((root) => {
    if (!existsSync(root)) return [];
    const entries = fs.readdirSync(root);
    return entries
      .filter((name) => (
        (name.startsWith('ultimate-terminal-worker') || name.startsWith('worker-linux')) &&
        name.endsWith(`.${ext}`)
      ))
      .map((name) => ({
        name,
        path: path.join(root, name),
        score: (() => {
          const key = normalizeToken(name);
          let score = 0;
          if (osKey && key.includes(osKey)) score += 4;
          if (versionKey && key.includes(versionKey)) score += 3;
          if (versionCompact && key.includes(versionCompact)) score += 2;
          if (archKey && key.includes(archKey)) score += 1;
          if (key.includes('compat') || key.includes('glibc')) score += 1;
          return score;
        })(),
      }));
  });

  const file = candidates
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.name.length - a.name.length;
    })[0];

  if (!file) {
    res.status(404).send('Paquete de worker no encontrado en el servidor.');
    return;
  }

  const filename = ext === 'deb' ? 'worker-linux.deb' : 'worker-linux.rpm';
  res.download(file.path, filename);
});



export default app;
