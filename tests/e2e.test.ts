import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const NEXUS_PORT = 3003;
const NEXUS_URL = `http://localhost:${NEXUS_PORT}`;
const ADMIN_PASSWORD = 'test-pass-123';
const WORKER_TOKEN = 'worker-token-test';
const JWT_SECRET = 'test-secret-token';
const DATA_DIR = path.resolve(__dirname, '..', `.qodo-${NEXUS_PORT}`);

async function waitForServer(url: string, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/auth/status`);
      if (res.ok) return;
    } catch (e) {
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server at ${url} did not become ready`);
}

describe('Ultimate Terminal E2E', () => {
  let nexusProcess: ChildProcess;
  let workerProcess: ChildProcess;
  let clientSocket: any;

  beforeAll(async () => {
    await fs.rm(DATA_DIR, { force: true, recursive: true });

    nexusProcess = spawn('npx', ['ts-node', 'nexus/src/index.ts'], {
      env: {
        ...process.env,
        PORT: NEXUS_PORT.toString(),
        NEXUS_JWT_SECRET: JWT_SECRET,
        ADMIN_PASSWORD,
        WORKER_TOKEN,
        CLIENT_ORIGIN: '*',
        NEXUS_DATA_DIR: DATA_DIR
      },
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe'
    });

    await waitForServer(NEXUS_URL);

    workerProcess = spawn('npx', ['ts-node', 'worker/src/index.ts'], {
      env: { ...process.env, NEXUS_URL, WORKER_NAME: 'Test-Worker', WORKER_TOKEN },
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe'
    });

    workerProcess.stdout?.on('data', (d) => console.log(`[Worker Output]: ${d}`));

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }, 20000);

  afterAll(() => {
    nexusProcess.kill();
    workerProcess.kill();
    if (clientSocket) clientSocket.disconnect();
  });

  it('should allow a client to connect and receive worker list', async () => {
    const login = await fetch(`${NEXUS_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    if (!login.ok) {
      throw new Error(`Login failed: ${login.status}`);
    }
    const { token } = await login.json();

    return new Promise<void>((resolve, reject) => {
      clientSocket = Client(NEXUS_URL, { auth: { token, type: 'client' } });
      
      clientSocket.on('connect', () => {
        clientSocket.emit('register', { type: 'client' });
      });

      clientSocket.on('worker-list', (workers: any[]) => {
        try {
          expect(workers).toBeDefined();
          expect(Array.isArray(workers)).toBe(true);
          const found = workers.find(w => w.name === 'Test-Worker');
          expect(found).toBeDefined();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }, 15000);

  it('should execute a command and return PTY output', async () => {
    return new Promise<void>((resolve, reject) => {
      let outputBuffer = '';

      clientSocket.on('output', (data: any) => {
        outputBuffer += data.data;
        if (outputBuffer.includes('uid=')) {
          resolve();
        }
      });

      clientSocket.emit('register', { type: 'client' });
      clientSocket.once('worker-list', (workers: any[]) => {
        const target = workers.find((w: any) => w.name === 'Test-Worker');
        if (!target) return reject(new Error('Worker not found'));

        clientSocket.emit('execute', {
          workerId: target.id,
          command: 'id\n'
        });
      });
    });
  }, 15000);
});
