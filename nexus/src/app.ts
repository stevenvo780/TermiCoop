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

if [ -f /etc/debian_version ]; then
  echo \"Descargando worker .deb...\"
  curl -fL \"\${NEXUS_URL}/api/downloads/latest/worker-linux.deb\" -o /tmp/worker.deb
  echo \"Instalando...\"
  sudo dpkg -i /tmp/worker.deb || sudo apt-get install -f -y
elif [ -f /etc/redhat-release ] || [ -f /etc/centos-release ] || [ -f /etc/fedora-release ]; then
  echo \"Descargando worker .rpm...\"
  curl -fL \"\${NEXUS_URL}/api/downloads/latest/worker-linux.rpm\" -o /tmp/worker.rpm
  echo \"Instalando...\"
  sudo rpm -Uvh /tmp/worker.rpm
else
  echo \"Distribucion no soportada automaticamente. Usa el binario o paquete manualmente.\"
  exit 1
fi

CONFIG_FILE=\"/etc/ultimate-terminal/worker.env\"
sudo mkdir -p /etc/ultimate-terminal
if grep -q \"NEXUS_URL=\" \"\${CONFIG_FILE}\" 2>/dev/null; then
  sudo sed -i \"s|^NEXUS_URL=.*|NEXUS_URL=\${NEXUS_URL}|\" \"\${CONFIG_FILE}\"
else
  echo \"NEXUS_URL=\${NEXUS_URL}\" | sudo tee -a \"\${CONFIG_FILE}\" >/dev/null
fi
if grep -q \"API_KEY=\" \"\${CONFIG_FILE}\" 2>/dev/null; then
  sudo sed -i \"s|^API_KEY=.*|API_KEY=\${API_KEY}|\" \"\${CONFIG_FILE}\"
else
  echo \"API_KEY=\${API_KEY}\" | sudo tee -a \"\${CONFIG_FILE}\" >/dev/null
fi

echo \"Reiniciando servicio...\"
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart ultimate-terminal-worker || true
fi
echo \"Listo: worker configurado.\"
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
    const allowed = ext === 'deb' || ext === 'rpm';
    if (!allowed) {
      res.status(400).send('Formato no soportado. Usa .deb o .rpm');
      return;
    }

    const file = downloadRoots
      .map(root => {
        if (!existsSync(root)) return null;
        const entries = fs.readdirSync(root);
        return entries
          .filter(name => (
            (name.startsWith('ultimate-terminal-worker') || name.startsWith('worker-linux')) &&
            name.endsWith(`.${ext}`)
          ))
          .map(name => path.join(root, name))[0];
      })
      .find(Boolean);

    if (!file) {
      res.status(404).send('Paquete de worker no encontrado en el servidor.');
      return;
    }

    const filename = ext === 'deb' ? 'worker-linux.deb' : 'worker-linux.rpm';
    res.download(file, filename);
});

const clientPaths = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'public'),
  '/usr/share/ultimate-terminal/public',
  path.resolve(__dirname, '../public'),
];
const clientDistPath = clientPaths.find(p => existsSync(p));

if (clientDistPath) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
  console.log(`Serving client from ${clientDistPath}`);
}

export default app;
