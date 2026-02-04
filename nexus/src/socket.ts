
import { Server, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from './utils/jwt';
import { WorkerModel, Worker } from './models/worker.model';
import { UserModel } from './models/user.model';
import db from './config/database';

/**
 * Data attached to the socket instance.
 */
interface SocketData {
  role: 'client' | 'worker';
  user?: JwtPayload;
  workerId?: string;
}

export const workers: Map<string, Worker & { socketId: string }> = new Map();

/**
 * Represents an active terminal session.
 */
interface ActiveSession {
  id: string;
  workerId: string;
  output: string;
  displayName: string;
  workerName: string;
  workerKey: string;
  createdAt: number;
  lastActive: number;
}
const activeSessions: Map<string, ActiveSession> = new Map();
const sessionSubscribers: Map<string, Set<string>> = new Map();

const sessionKey = (workerId: string, sessionId: string) => `${workerId}:${sessionId}`;

const normalizeSessionId = (sessionId?: string) => {
  const trimmed = sessionId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'default';
};

const addSessionSubscriber = (sessionId: string, socketId: string) => {
  const set = sessionSubscribers.get(sessionId) || new Set<string>();
  set.add(socketId);
  sessionSubscribers.set(sessionId, set);
};

const removeSessionSubscriber = (sessionId: string, socketId: string) => {
  const set = sessionSubscribers.get(sessionId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) {
    sessionSubscribers.delete(sessionId);
  }
};

const removeSocketFromAllSessions = (socketId: string) => {
  for (const [sessionId, set] of sessionSubscribers.entries()) {
    if (set.has(socketId)) {
      set.delete(socketId);
      if (set.size === 0) {
        sessionSubscribers.delete(sessionId);
      }
    }
  }
};

/**
 * Initializes the Socket.IO server and handles connection logic.
 * @param httpServer - The HTTP server instance to attach to.
 * @returns The initialized Socket.IO server instance.
 */
export const initSocket = (httpServer: any) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // Enforce compression for terminal streams
    perMessageDeflate: {
      threshold: 1024,
    },
    httpCompression: true,
  });

  const emitWorkerList = (socket: Socket, list: any[]) => {
    socket.emit('workers', list);
    socket.emit('worker-list', list);
  };

  const sendWorkerListToSocket = async (socket: Socket) => {
    const socketData = socket.data as SocketData;
    if (socketData.role === 'client' && socketData.user) {
      const list = await WorkerModel.getAccessibleWorkers(socketData.user.userId);
      emitWorkerList(socket, list);
    }
  };

  const broadcastWorkerUpdates = () => {
    io.sockets.sockets.forEach((socket) => {
      sendWorkerListToSocket(socket).catch(console.error);
    });
  };


  const broadcastSessionList = async () => {
    // Optimization: Calculate set of sessions visible per user ID instead of iterating all sockets if scaling is needed.
    const sockets = Array.from(io.sockets.sockets.values());
    await Promise.all(sockets.map(async (socket) => {
      const socketData = socket.data as SocketData;
      if (socketData.role !== 'client' || !socketData.user) return;
      const userId = socketData.user.userId;

      // Filter sessions active for this user
      const sessions = await Promise.all(Array.from(activeSessions.values()).map(async s => {
        const hasAccess = await WorkerModel.hasAccess(userId, s.workerId, 'view');
        return hasAccess ? s : null;
      }));

      const filtered = sessions.filter(s => s !== null).map(s => ({
        id: s!.id,
        workerName: s!.workerName,
        workerKey: s!.workerKey,
        displayName: s!.displayName,
        createdAt: s!.createdAt,
        lastActiveAt: s!.lastActive
      }));

      socket.emit('session-list', filtered);
    }));
  };

  const ensureActiveSession = async (workerId: string, sessionIdRaw?: string, displayName?: string) => {
    const sessionId = normalizeSessionId(sessionIdRaw);
    const key = sessionKey(workerId, sessionId);
    let existing = activeSessions.get(key);
    if (existing) {
      return existing;
    }

    // Try to get name from connected workers cache first (sync)
    let workerName = 'Worker';
    const connectedWorker = workers.get(workerId);
    if (connectedWorker) {
      workerName = connectedWorker.name;
    } else {
      const worker = await WorkerModel.findById(workerId);
      if (worker) workerName = worker.name;
    }

    const workerKey = workerName.toLowerCase();
    existing = {
      id: sessionId,
      workerId,
      output: '',
      displayName: displayName || sessionId,
      workerName,
      workerKey,
      createdAt: Date.now(),
      lastActive: Date.now()
    };
    activeSessions.set(key, existing);
    return existing;
  };

  io.use(async (socket, next) => {
    const { token, type, apiKey, workerName } = (socket.handshake.auth || {}) as any;


    try {
      if (type === 'client') {
        if (!token) return next(new Error('Missing token'));
        const payload = verifyToken(token);

        /** Validate that the user still exists in the database. */
        const userExists = await UserModel.findById(payload.userId);
        if (!userExists) {
          return next(new Error('User invalid or no longer exists'));
        }

        socket.data = { role: 'client', user: payload } as SocketData;
        console.log(`[Socket] Client connected: ${payload.username} (${payload.userId})`);
        return next();
      }

      if (type === 'worker') {
        if (!apiKey) {
          return next(new Error('Missing API Key'));
        }
        const worker = await WorkerModel.findByApiKey(apiKey);

        if (!worker) {
          return next(new Error('Invalid API Key'));
        }

        if (workerName && typeof workerName === 'string' && workerName.trim() && workerName.trim() !== worker.name) {
          await WorkerModel.updateName(worker.id, workerName.trim());
          worker.name = workerName.trim();
        }

        socket.data = { role: 'worker', workerId: worker.id } as SocketData;

        workers.set(worker.id, { ...worker, socketId: socket.id, status: 'online' });

        await WorkerModel.updateStatus(worker.id, 'online');

        return next();
      }

      return next(new Error('Invalid connection type'));
    } catch (err: any) {
      console.error('[AuthDebug] Error in middleware:', err);
      return next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;


    if (data.role === 'worker' && data.workerId) {

      broadcastWorkerUpdates();
    }

    if (data.role === 'client' && data.user) {
      sendWorkerListToSocket(socket);
      broadcastSessionList();
    }

    socket.on('disconnect', async () => {
      if (data.role === 'worker' && data.workerId) {
        workers.delete(data.workerId);
        await WorkerModel.updateStatus(data.workerId, 'offline');

        broadcastWorkerUpdates();
      }
      removeSocketFromAllSessions(socket.id);
    });

    socket.on('heartbeat', async () => {
      if (data.role === 'worker' && data.workerId) {
        await WorkerModel.updateStatus(data.workerId, 'online');
      }
    });

    socket.on('register', (msg: { type?: string }) => {
      if (msg?.type === 'client' && data.role === 'client') {
        sendWorkerListToSocket(socket);
        broadcastSessionList();
      }
    });

    socket.on('execute', async (msg: { workerId: string; command: string; sessionId?: string }) => {
      if (data.role !== 'client' || !data.user) return;
      const sessionId = normalizeSessionId(msg.sessionId || socket.id);

      const hasAccess = await WorkerModel.hasAccess(data.user.userId, msg.workerId, 'control');
      if (!hasAccess) {
        socket.emit('error', 'Access denied to worker');
        return;
      }

      const worker = workers.get(msg.workerId);
      if (!worker) {
        socket.emit('error', 'Worker is offline');
        return;
      }

      const session = await ensureActiveSession(msg.workerId, sessionId);
      session.lastActive = Date.now();
      addSessionSubscriber(sessionId, socket.id);
      io.to(worker.socketId).emit('execute', {
        clientId: socket.id,
        command: msg.command,
        sessionId
      });

      broadcastSessionList();
    });

    socket.on('resize', async (msg: { workerId: string; cols: number; rows: number; sessionId?: string }) => {
      if (data.role !== 'client' || !data.user) return;
      const sessionId = normalizeSessionId(msg.sessionId || socket.id);

      const hasAccess = await WorkerModel.hasAccess(data.user.userId, msg.workerId, 'control');
      if (!hasAccess) {
        socket.emit('error', 'Access denied to worker');
        return;
      }
      const worker = workers.get(msg.workerId);
      if (!worker) {
        socket.emit('error', 'Worker is offline');
        return;
      }
      await ensureActiveSession(msg.workerId, sessionId);
      addSessionSubscriber(sessionId, socket.id);
      io.to(worker.socketId).emit('resize', {
        clientId: socket.id,
        sessionId,
        cols: msg.cols,
        rows: msg.rows,
      });
    });

    socket.on('output', async (msg: { sessionId?: string; output: string }) => {
      if (data.role !== 'worker' || !data.workerId) return;
      const sessionId = normalizeSessionId(msg.sessionId);
      const session = await ensureActiveSession(data.workerId, sessionId);
      session.output = `${session.output}${msg.output}`.slice(-20000);
      session.lastActive = Date.now();

      const subs = sessionSubscribers.get(sessionId);
      if (subs && subs.size > 0) {
        io.to(Array.from(subs)).emit('output', {
          workerId: data.workerId,
          sessionId,
          data: msg.output
        });
      }
      // Debounce broadcast if needed, or simple broadcast
      broadcastSessionList();
    });

    socket.on('session-shell-exited', (msg: { sessionId?: string }) => {
      if (data.role !== 'worker' || !data.workerId) return;
      const sessionId = normalizeSessionId(msg.sessionId);
      const key = sessionKey(data.workerId, sessionId);
      activeSessions.delete(key);
      const subs = sessionSubscribers.get(sessionId);
      if (subs && subs.size > 0) {
        io.to(Array.from(subs)).emit('session-closed', { sessionId });
      }
      sessionSubscribers.delete(sessionId);
      broadcastSessionList();
    });

    socket.on('subscribe', async (msg: { workerId: string }) => {
      if (data.role !== 'client' || !data.user) return;
      const hasAccess = await WorkerModel.hasAccess(data.user.userId, msg.workerId, 'view');
      if (hasAccess) {
        socket.join(`worker:${msg.workerId}`);
      } else {
        socket.emit('error', 'Access denied');
      }
    });

    socket.on('join-session', async (msg: { sessionId: string; workerId?: string; displayName?: string }) => {
      if (data.role !== 'client' || !data.user) return;
      const sessionId = normalizeSessionId(msg.sessionId || socket.id);
      addSessionSubscriber(sessionId, socket.id);

      // Look for session to find workerId
      let workerId = msg.workerId;
      if (!workerId) {
        const s = Array.from(activeSessions.values()).find(s => s.id === sessionId);
        if (s) workerId = s.workerId;
      }

      if (workerId) {
        const hasAccess = await WorkerModel.hasAccess(data.user.userId, workerId, 'view');
        if (hasAccess) {
          const session = await ensureActiveSession(workerId, sessionId, msg.displayName);
          session.lastActive = Date.now();
        }
      }
      broadcastSessionList();
    });

    socket.on('leave-session', (msg: { sessionId: string }) => {
      const sessionId = normalizeSessionId(msg.sessionId || socket.id);
      removeSessionSubscriber(sessionId, socket.id);
    });

    socket.on('rename-session', async (msg: { sessionId: string; newName: string }) => {
      if (data.role !== 'client' || !data.user) return;
      const sessionId = normalizeSessionId(msg.sessionId);
      const newName = (msg.newName || '').trim();
      if (!newName) return;

      const session = Array.from(activeSessions.values()).find(s => s.id === sessionId);
      if (!session) return;

      const hasAccess = await WorkerModel.hasAccess(data.user.userId, session.workerId, 'control');
      if (!hasAccess) return;

      session.displayName = newName;
      try {
        await db.run('UPDATE sessions SET display_name = ? WHERE id = ?', [newName, sessionId]);
      } catch (err) {
        console.error('Failed to update session name in DB:', err);
      }
      broadcastSessionList();
    });

    socket.on('close-session', async (msg: { sessionId: string }) => {
      if (data.role !== 'client' || !data.user) return;
      const sessionId = normalizeSessionId(msg.sessionId);

      const session = Array.from(activeSessions.values()).find(s => s.id === sessionId);
      if (!session) return;

      const hasAccess = await WorkerModel.hasAccess(data.user.userId, session.workerId, 'control');
      if (!hasAccess) return;

      const worker = workers.get(session.workerId);
      if (worker) {
        const workerSocket = io.sockets.sockets.get(worker.socketId);
        if (workerSocket) {
          workerSocket.emit('kill-session', { sessionId });
        }
      }

      const key = sessionKey(session.workerId, sessionId);
      activeSessions.delete(key);
      removeSessionSubscriber(sessionId, socket.id);

      broadcastSessionList();
    });

    socket.on('get-session-output', async (msg: { sessionId: string }, cb?: (output: string) => void) => {
      if (data.role !== 'client' || !data.user) return;
      const sessionId = normalizeSessionId(msg.sessionId);

      const session = Array.from(activeSessions.values()).find(s => s.id === sessionId);
      if (session) {
        const hasAccess = await WorkerModel.hasAccess(data.user!.userId, session.workerId, 'view');
        if (hasAccess && cb) {
          cb(session.output || '');
        }
      } else if (cb) {
        cb('');
      }
    });
  });

  return io;
};
