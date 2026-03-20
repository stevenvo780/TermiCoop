# TermiCoop — Instrucciones para IA (Setup completo de Workers)

> **Prompt para otra IA con acceso sudo en vpn-principal**
> Fecha: 2025-07-11

---

## CONTEXTO

- **Nexus** corre en `vpn-principal` como servicio `ultimate-terminal-nexus.service`
- **URL pública**: `https://terminal.humanizar-dev.cloud` (port 3002 local, nginx 8443 SSL)
- **Frontend**: `https://ultimate-terminal.vercel.app`
- **DB**: Neon PostgreSQL (config en `/etc/ultimate-terminal/nexus.env`)
- **Usuario**: `stev` (id=9), actualmente plan `free` → necesita upgrade a `enterprise`
- **Worker existente**: `vpn-principal` con ID `8be56aad-1358-48f7-a8fe-e373163406d6` (ya creado)
- Hay 2 archivos en `/tmp/` del servidor listos para usar

---

## FASE 1 — Crear los workers (ejecutar en vpn-principal con sudo)

Ya hay un script automatizado en el servidor. Ejecútalo:

```bash
sudo bash /tmp/setup-workers.sh
```

### Qué hace el script:
1. Copia `/tmp/app.js` → `/opt/ultimate-terminal-nexus/dist/app.js` (contiene endpoint temporal admin-upgrade)
2. `chown utnexus:utnexus` y reinicia `ultimate-terminal-nexus.service`
3. Lee `ADMIN_PASSWORD` de `/etc/ultimate-terminal/nexus.env`
4. Llama a `POST /api/admin/upgrade-plan` para cambiar `stev` a plan `enterprise` + `isAdmin=true`
5. Obtiene JWT de `stev` vía login
6. Crea 9 workers nuevos (stev-server, humanizar2, humanizar1, servidor-i3, nass-stev, pc-stev, ws-humanizar, ws-personal, ws-indotel)
7. Lista los 10 workers con sus IDs

### ⚠️ IMPORTANTE: Captura la salida

El script imprime una tabla así:
```
=== Lista completa de workers ===
vpn-principal  → 8be56aad-...
stev-server    → xxxxxxxx-...
humanizar2     → xxxxxxxx-...
...
```

**Guarda todos los IDs.** Cada ID = `WORKER_TOKEN` para instalar en ese servidor.

---

## FASE 2 — Instalar worker en cada servidor

Para cada uno de los 10 servidores, conéctate por SSH y ejecuta la instalación.

### Servidores destino

| # | Nombre | SSH alias | SSH user | IP/acceso | Notas |
|---|--------|-----------|----------|-----------|-------|
| 1 | vpn-principal | vpn-principal | humanizar | 148.230.88.162 (port 49222) | Host del nexus |
| 2 | stev-server | stev-server | stev | 100.98.8.227 | Docker host, 16GB RAM |
| 3 | humanizar2 | humanizar2 | humanizar | 100.98.5.11 | Wazuh manager |
| 4 | humanizar1 | humanizar1 | humanizar | ProxyJump via servidor-i3 | |
| 5 | servidor-i3 | servidor-i3 | humanizar | 100.98.143.113 | Servidor ligero |
| 6 | nass-stev | nass-stev | nass | 100.98.67.189 | NAS ZFS |
| 7 | pc-stev | pc-stev | stev | 100.98.81.177 | KVM host, 123GB RAM |
| 8 | ws-humanizar | ws-humanizar | operador | 10.88.88.11 | VM en pc-stev |
| 9 | ws-personal | ws-personal | operador | VM en pc-stev | |
| 10 | ws-indotel | ws-indotel | operador | VM en pc-stev | |

### Procedimiento por servidor

En cada servidor, ejecuta con sudo:

```bash
#!/bin/bash
set -euo pipefail

NEXUS_URL="https://terminal.humanizar-dev.cloud"
WORKER_TOKEN="<REEMPLAZA_CON_EL_ID_DE_LA_FASE_1>"
WORKER_NAME="<REEMPLAZA_CON_EL_NOMBRE>"

echo "=== Instalando TermiCoop worker: $WORKER_NAME ==="

# 1. Requisitos
if ! command -v node &>/dev/null; then
  echo "Instalando Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo apt-get install -y build-essential python3 make gcc

# 2. Clonar y compilar worker
cd /tmp
rm -rf TermiCoop-worker-install
git clone --depth 1 https://github.com/stevenvo780/TermiCoop.git TermiCoop-worker-install
cd TermiCoop-worker-install/worker
npm install
npx tsc

# 3. Instalar binarios
sudo mkdir -p /opt/ultimate-terminal-worker
sudo cp -r dist node_modules package.json /opt/ultimate-terminal-worker/

# 4. Configurar
sudo mkdir -p /etc/ultimate-terminal
sudo tee /etc/ultimate-terminal/worker.env > /dev/null << EOF
NEXUS_URL=$NEXUS_URL
WORKER_TOKEN=$WORKER_TOKEN
WORKER_NAME=$WORKER_NAME
WORKER_HEARTBEAT_MS=5000
AUTO_RESTART_SHELL=true
EOF
sudo chmod 600 /etc/ultimate-terminal/worker.env

# 5. Servicio systemd
sudo tee /etc/systemd/system/ultimate-terminal-worker.service > /dev/null << 'SVCEOF'
[Unit]
Description=TermiCoop Worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/ultimate-terminal/worker.env
ExecStart=/usr/bin/node /opt/ultimate-terminal-worker/dist/index.js
WorkingDirectory=/opt/ultimate-terminal-worker
Restart=always
RestartSec=5
User=root
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
SVCEOF

# 6. Arrancar
sudo systemctl daemon-reload
sudo systemctl enable --now ultimate-terminal-worker

# 7. Verificar
sleep 3
sudo systemctl status ultimate-terminal-worker --no-pager -l
echo "=== Worker $WORKER_NAME instalado ==="

# 8. Limpiar
rm -rf /tmp/TermiCoop-worker-install
```

### ⚡ Comando rápido por servidor (copiar, pegar y ajustar)

```bash
# vpn-principal (WORKER_TOKEN del paso 1)
ssh vpn-principal 'NEXUS_URL=https://terminal.humanizar-dev.cloud WORKER_TOKEN=<ID> WORKER_NAME=vpn-principal sudo -E bash -c "$(curl -fsSL https://raw.githubusercontent.com/stevenvo780/TermiCoop/main/packaging/universal_install.sh)"'
```

Si el instalador universal no existe o falla, usa el script manual de arriba.

---

## FASE 3 — Verificación global

Desde `vpn-principal`:

```bash
TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"stev","password":"TermiCoop2026!Stev"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s http://localhost:3002/api/workers \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
workers = json.load(sys.stdin)
online = sum(1 for w in workers if w.get('status') == 'online')
print(f'Workers: {len(workers)} total, {online} online')
for w in workers:
    print(f\"  {w['name']:20s} {w.get('status','?'):8s} {w['id']}\")
"
```

**Resultado esperado**: 10 workers, todos `online`.

---

## FASE 4 — Limpieza post-instalación

Una vez confirmado que todo funciona, en `vpn-principal`:

```bash
# Eliminar archivos temporales
sudo rm -f /tmp/app.js /tmp/setup-workers.sh

# Opcional: restaurar app.js sin el endpoint admin-upgrade
# (el endpoint está protegido por ADMIN_PASSWORD así que no es urgente)
```

---

## Notas
- **WORKER_TOKEN** = el **UUID** (id) de cada worker retornado por la API
- El worker se conecta al nexus vía Socket.IO (WebSocket transport)
- `nass-stev` usa usuario `nass`, no `humanizar`
- `humanizar1` requiere ProxyJump vía `servidor-i3`
- Las VMs `ws-*` están en red interna `10.88.88.x` de `pc-stev`
- Credenciales del usuario: `stev` / `TermiCoop2026!Stev`
- Frontend: `https://ultimate-terminal.vercel.app`
- El worker existente `vpn-principal` ya tiene ID `8be56aad-1358-48f7-a8fe-e373163406d6`
