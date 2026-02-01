# Ultimate Terminal

A distributed terminal system allowing you to control and view your devices from anywhere.

## Architecture
- **Nexus (Server)**: Relay server (Port 3002).
- **Worker (Agent)**: Runs on the target machine (your PC/VPS). Connects to Nexus.
- **Client (UI)**: Web interface to view and control workers.

## 📦 Generated Installers

| Component | Platform | Location | Description |
|-----------|----------|----------|-------------|
| **Worker** | Linux | `worker/bin/worker-linux` | Standalone binary. Copy to any VPS/PC and run. |

## Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Nexus (The Hub)**
   ```bash
   npm run start:nexus
   ```

3. **Start Worker (Dev Mode)**
   ```bash
   npm run start:worker
   ```

4. **Start Client (Web Dev Mode)**
   ```bash
   npm run start:client
   ```

## Debian (.deb) Packages

Build .deb packages for Nexus and Worker (systemd + config included):
```bash
npm run package:deb
```
Artifacts are written to `dist/packages/`.

The web client builds to `client/dist` and is bundled into the Nexus package.

## Docker Deploy (3 servicios)

Build .deb packages and deploy Nexus + Worker + Client using Docker:
```bash
npm run docker:deploy
```

Validate stack:
```bash
npm run docker:test
```

Defaults:
- Nexus: `http://localhost:13002` (`NEXUS_PORT`)
- Client: `http://localhost:13003` (`CLIENT_PORT`)
If you change `NEXUS_PORT`, also set `VITE_NEXUS_URL` for the client build.

## Configuration (env)
- Copy `.env.example` to `.env` and adjust as needed.
- Important:
  - Set a strong `NEXUS_JWT_SECRET` (required in production) and `ADMIN_PASSWORD` for first boot.
  - Set the same `WORKER_TOKEN` in Nexus and each worker.
  - Optional: set `NEXUS_SETUP_TOKEN` to allow remote first-time setup (UI has a Setup Token field).
  - Optional: set `ALLOW_UNAUTHENTICATED_WORKERS=true` to accept workers without a token (not recommended).
  - Point `VITE_NEXUS_URL` and `CLIENT_ORIGIN` to your deployment URLs.

## API y eventos relevantes
- Auth REST:
  - `POST /api/auth/setup` `{ password, setupToken? }` crea admin inicial (requiere `NEXUS_SETUP_TOKEN` si está definido).
  - `POST /api/auth/login` `{ username?, password }` (por defecto usa admin si no hay username).
  - `POST /api/auth/register` `{ username, password, setupToken? }` valida `NEXUS_SETUP_TOKEN` si existe.
  - `POST /api/auth/password` `{ currentPassword, newPassword }` (autenticado).
- Worker REST:
  - `GET /api/workers`, `POST /api/workers` crea con API key, `DELETE /api/workers/:id` rechaza si está online.
- Socket.io (client): `workers`/`worker-list`, `session-list`, `output`, `session-closed`; comandos: `subscribe`, `execute`, `resize`, `join-session`, `leave-session`, `get-session-output`.
- Socket.io (worker): conectar con `auth { type: 'worker', apiKey, workerName }`, emitir `heartbeat`, `output`, `session-shell-exited`.
- Persistencia de sesiones: Nexus mantiene sesiones activas en memoria; los metadatos se emiten a clientes (`session-list`), pero no se guardan en disco tras reinicio. Si se requiere persistencia, añadir almacenamiento en BD antes de producción.

## Tests
- Lint: `npm run lint --workspace=client`.
- Type-check: `npx tsc --noEmit --project nexus/tsconfig.json` y `npx tsc --noEmit --project worker/tsconfig.json`.
- Playwright (requiere stack corriendo: Nexus en :13002, client servido en :13003, worker apuntando a Nexus): `npx playwright test tests/terminal-e2e.spec.ts`.
