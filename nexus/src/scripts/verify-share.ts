
import dotenv from 'dotenv';
dotenv.config();
import { initDatabase } from '../config/database';
import { UserModel } from '../models/user.model';
import { WorkerModel } from '../models/worker.model';
import path from 'path';

async function main() {
  console.log('[Verify] Initializing DB...');
  await initDatabase();

  try {
    // 1. Ensure Users Exist
    const userA_Name = 'subagent_user_a';
    const userB_Name = 'subagent_user_b';
    const password = 'password123';

    let userA = await UserModel.findByUsername(userA_Name);
    if (!userA) {
      console.log(`[Verify] Creating ${userA_Name}...`);
      userA = await UserModel.create(userA_Name, password);
    }

    let userB = await UserModel.findByUsername(userB_Name);
    if (!userB) {
      console.log(`[Verify] Creating ${userB_Name}...`);
      userB = await UserModel.create(userB_Name, password);
    }

    if (!userA || !userB) throw new Error("Failed to create users");

    console.log(`[Verify] User A ID: ${userA.id}`);
    console.log(`[Verify] User B ID: ${userB.id}`);

    // 2. Ensure Worker Exists for User A
    const workerName = 'subagent_worker_a';
    const workers = await WorkerModel.getAccessibleWorkers(userA.id);
    // Cast or handle type mismatch. WorkerModel.create returns Worker. getAccessibleWorkers returns Worker & { permission }.
    let worker: any = workers.find(w => w.name === workerName && w.owner_id === userA!.id);

    if (!worker) {
      console.log(`[Verify] Creating worker ${workerName} for User A...`);
      worker = await WorkerModel.create(userA.id, workerName);
    }

    if (!worker) throw new Error("Failed to find or create worker");

    console.log(`[Verify] Worker ID: ${worker.id}`);

    // 3. Share Worker with User B
    console.log(`[Verify] Sharing worker with User B...`);
    await WorkerModel.share(worker.id, userB.id, 'view');

    // 4. Verify Share
    const shares = await WorkerModel.getShares(worker.id);
    const userBShare = shares.find(s => s.userId === userB!.id);

    if (userBShare) {
      console.log('[Verify] SUCCESS: Share found in DB:', userBShare);
    } else {
      console.error('[Verify] FAILURE: Share NOT found in DB.');
      process.exit(1);
    }

    // ... (previous code)

    // 5. Verify Accessibility from User B perspective
    const userBWorkers = await WorkerModel.getAccessibleWorkers(userB.id);
    const targetWorker = userBWorkers.find(w => w.id === worker!.id);

    if (targetWorker) {
      console.log('[Verify] SUCCESS: User B can see the worker via getAccessibleWorkers.');
    } else {
      console.error('[Verify] FAILURE: User B CANNOT see the worker via getAccessibleWorkers.');
      process.exit(1);
    }

    // 6. Verify JWT Payload Type
    console.log('[Verify] Testing JWT Token flow...');
    const { signToken, verifyToken } = require('../utils/jwt');
    const token = signToken({ userId: userB.id, username: userB.username, isAdmin: false });
    const decoded = verifyToken(token);

    console.log(`[Verify] Original UserID: ${userB.id} (Type: ${typeof userB.id})`);
    console.log(`[Verify] Decoded UserID: ${decoded.userId} (Type: ${typeof decoded.userId})`);

    if (decoded.userId !== userB.id) {
      console.error('[Verify] FAILURE: Token ID mismatch!');
      process.exit(1);
    }

    const workersFromToken = await WorkerModel.getAccessibleWorkers(decoded.userId);
    const found = workersFromToken.find(w => w.id === worker!.id);
    if (found) {
      console.log('[Verify] SUCCESS: Worker found using decoded token ID.');
    } else {
      console.error('[Verify] FAILURE: Worker NOT found using decoded token ID.');
      process.exit(1);
    }


  } catch (err) {
    console.error('[Verify] Error:', err);
    process.exit(1);
  }
}

main();
