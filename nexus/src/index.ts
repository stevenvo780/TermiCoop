
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import app from './app';
import { initSocket } from './socket';
import { initDatabase } from './config/database';
import { UserModel } from './models/user.model';
import { WorkerModel } from './models/worker.model';

const PORT = process.env.PORT || 3002;

const startServer = async () => {
    console.log('[Nexus] Initializing database...');
    await initDatabase();

    const adminPassword = process.env.ADMIN_PASSWORD;
    let adminId: number | undefined;

    if (adminPassword) {
        const adminUser = await UserModel.findByUsername('admin');
        if (!adminUser) {
            console.log('[Nexus] Creating default admin user...');
            const newAdmin = await UserModel.create('admin', adminPassword, true);
            adminId = newAdmin.id;
        } else {
            adminId = adminUser.id;
        }
    }

    const devWorkerToken = process.env.WORKER_TOKEN;
    if (devWorkerToken && adminId) {
        const existingWorker = await WorkerModel.findByApiKey(devWorkerToken);
        if (!existingWorker) {
            console.log('[Nexus] Creating default dev worker from WORKER_TOKEN...');
            await WorkerModel.create(adminId, 'Docker-Dev-Worker', undefined, devWorkerToken);
        }
    }

    const httpServer = createServer(app);
    // initSocket might be internal, but if it uses models, it manages its own async events.
    // We pass server.
    const io = initSocket(httpServer);
    app.set('io', io);

    httpServer.listen(PORT, () => {
        console.log(`[Nexus] Server running on port ${PORT}`);
    });
};

startServer().catch(err => {
    console.error('[Nexus] Failed to start server:', err);
    process.exit(1);
});
