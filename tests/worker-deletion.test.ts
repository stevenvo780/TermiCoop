import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const NEXUS_PORT = 3005;
const NEXUS_URL = `http://localhost:${NEXUS_PORT}`;
const ADMIN_PASSWORD = 'test-pass-delete';
const WORKER_TOKEN = 'worker-token-test-delete';
const JWT_SECRET = 'test-secret-token-delete';

describe('Worker Deletion', () => {
    let nexusProcess: ChildProcess;
    let workerProcess: ChildProcess;
    let token: string;
    let workerId: string;

    beforeAll(async () => {
        try {
            await fs.rm(path.resolve(__dirname, '..', 'nexus.db'), { force: true });
            await fs.rm(path.resolve(__dirname, '..', '.qodo'), { force: true, recursive: true });
        } catch (e) {}

        nexusProcess = spawn('npx', ['ts-node', 'nexus/src/index.ts'], {
            env: {
                ...process.env,
                PORT: NEXUS_PORT.toString(),
                NEXUS_JWT_SECRET: JWT_SECRET,
                ADMIN_PASSWORD,
                WORKER_TOKEN,
                CLIENT_ORIGIN: '*'
            },
            cwd: path.resolve(__dirname, '..'),
            stdio: 'pipe'
        });
        
        nexusProcess.stdout?.on('data', (d) => console.log(`[Nexus]: ${d}`));
        nexusProcess.stderr?.on('data', (d) => console.error(`[Nexus ERR]: ${d}`));

        await new Promise((resolve) => setTimeout(resolve, 5000));

        workerProcess = spawn('npx', ['ts-node', 'worker/src/index.ts'], {
            env: { ...process.env, NEXUS_URL, WORKER_NAME: 'Test-Delete-Worker', WORKER_TOKEN },
            cwd: path.resolve(__dirname, '..'),
            stdio: 'pipe'
        });
        
        workerProcess.stdout?.on('data', (d) => console.log(`[Worker]: ${d}`));
        workerProcess.stderr?.on('data', (d) => console.error(`[Worker ERR]: ${d}`));

        await new Promise((resolve) => setTimeout(resolve, 3000));


        const login = await fetch(`${NEXUS_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: ADMIN_PASSWORD })
        });
        if (!login.ok) {
             const text = await login.text();
             console.error('Login failed:', login.status, text);
             throw new Error('Login failed: ' + text);
        }
        const data = await login.json();
        token = data.token;
        console.log('Got token:', token);
    }, 20000);

    afterAll(() => {
        if (nexusProcess) nexusProcess.kill();
        if (workerProcess) workerProcess.kill();
    });

    it('should list the connected worker', async () => {
        const res = await fetch(`${NEXUS_URL}/api/workers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const workers = await res.json();
        console.log('Workers found:', JSON.stringify(workers, null, 2));
        if (!Array.isArray(workers)) {
            console.error('Workers list unexpected:', workers);
        }
        expect(Array.isArray(workers)).toBe(true);
        expect(workers.length).toBeGreaterThan(0);
        const w = workers[0]; 
        expect(w).toBeDefined();
        workerId = w.id;
        expect(w.status).toBe('online');
    });

    it.skip('should fail to delete online worker when policy requires offline', async () => {});

    it('should delete the worker after it goes offline', async () => {
        workerProcess.kill();
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        const res = await fetch(`${NEXUS_URL}/api/workers/${workerId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);

        const listRes = await fetch(`${NEXUS_URL}/api/workers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const workers = await listRes.json();
        const found = workers.find((w: any) => w.id === workerId);
        expect(found).toBeUndefined();
    });
});
