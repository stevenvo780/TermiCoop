import { Server, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from './utils/jwt';
import { WorkerModel, Worker } from './models/worker.model';

interface SocketData {
  role: 'client' | 'worker';
  user?: JwtPayload;
  workerId?: string;
}

export const workers: Map<string, Worker & { socketId: string }> = new Map();

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

export const initSocket = (httpServer: any) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const emitWorkerList = (socket: Socket, list: any[]) => {
    socket.emit('workers', list);
    socket.emit('worker-list', list);
  };

  const sendWorkerListToSocket = (socket: Socket) => {
    const socketData = socket.data as SocketData;
    if (socketData.role === 'client' && socketData.user) {
      const list = WorkerModel.getAccessibleWorkers(socketData.user.userId);
      emitWorkerList(socket, list);
    }
  };

  const broadcastWorkerUpdates = () => {
    io.sockets.sockets.forEach((socket) => {
      sendWorkerListToSocket(socket);
    });
  };

  const broadcastSessionList = () => {
    io.sockets.sockets.forEach((socket) => {
      const socketData = socket.data as SocketData;
      if (socketData.role !== 'client' || !socketData.user) return;
      const userId = socketData.user.userId;
      const sessions = Array.from(activeSessions.values())
        .filter(s => WorkerModel.hasAccess(userId, s.workerId, 'view'))
        .map(s => ({
          id: s.id,
          workerName: s.workerName,
          workerKey: s.workerKey,
          displayName: s.displayName,
          createdAt: s.createdAt,
          lastActiveAt: s.lastActive
        }));
      socket.emit('session-list', sessions);
    });
  };

  const ensureActiveSession = (workerId: string, sessionIdRaw?: string, displayName?: string) => {
    const sessionId = normalizeSessionId(sessionIdRaw);
    const key = sessionKey(workerId, sessionId);
    let existing = activeSessions.get(key);
    if (existing) {
      return existing;
    }
    const worker = WorkerModel.findById(workerId);
    const workerName = worker?.name || 'Worker';
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
        socket.data = { role: 'client', user: payload } as SocketData;
        return next();
      }
      
      if (type === 'worker') {
        if (!apiKey) return next(new Error('Missing API Key'));
        const worker = WorkerModel.findByApiKey(apiKey);
        if (!worker) return next(new Error('Invalid API Key'));
        if (workerName && typeof workerName === 'string' && workerName.trim() && workerName.trim() !== worker.name) {
          WorkerModel.updateName(worker.id, workerName.trim());
          worker.name = workerName.trim();
        }
        
        socket.data = { role: 'worker', workerId: worker.id } as SocketData;
        workers.set(worker.id, { ...worker, socketId: socket.id, status: 'online' });
        WorkerModel.updateStatus(worker.id, 'online');
        
        return next();
      }
      
      return next(new Error('Invalid connection type'));
    } catch (err: any) {
      return next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;
    console.log(`New connection: ${socket.id} (${data.role})`);

    if (data.role === 'worker' && data.workerId) {
        console.log(`Worker ${data.workerId} connected`);
        broadcastWorkerUpdates();
    }
    
    if (data.role === 'client' && data.user) {
        sendWorkerListToSocket(socket);
        broadcastSessionList();
    }

    socket.on('disconnect', () => {
       if (data.role === 'worker' && data.workerId) {
           workers.delete(data.workerId);
           WorkerModel.updateStatus(data.workerId, 'offline');
           console.log(`Worker ${data.workerId} disconnected`);
           broadcastWorkerUpdates();
       }
       removeSocketFromAllSessions(socket.id);
    });

    socket.on('heartbeat', () => {
      if (data.role === 'worker' && data.workerId) {
        WorkerModel.updateStatus(data.workerId, 'online');
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
       console.log(`[Nexus] execute from client ${socket.id} worker=${msg.workerId} session=${sessionId} len=${msg.command.length}`);
       if (!WorkerModel.hasAccess(data.user.userId, msg.workerId, 'control')) {
           socket.emit('error', 'Access denied to worker');
           return;
       }
       
       const worker = workers.get(msg.workerId);
       if (!worker) {
           socket.emit('error', 'Worker is offline');
           return;
       }
       
       const session = ensureActiveSession(msg.workerId, sessionId);
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
      if (!WorkerModel.hasAccess(data.user.userId, msg.workerId, 'control')) {
        socket.emit('error', 'Access denied to worker');
        return;
      }
      const worker = workers.get(msg.workerId);
      if (!worker) {
        socket.emit('error', 'Worker is offline');
        return;
      }
      ensureActiveSession(msg.workerId, sessionId);
      addSessionSubscriber(sessionId, socket.id);
      io.to(worker.socketId).emit('resize', {
        clientId: socket.id,
        sessionId,
        cols: msg.cols,
        rows: msg.rows,
      });
    });
    
    socket.on('output', (msg: { sessionId?: string; output: string }) => {
        if (data.role !== 'worker' || !data.workerId) return;
      const sessionId = normalizeSessionId(msg.sessionId);
      const session = ensureActiveSession(data.workerId, sessionId);
      session.output = `${session.output}${msg.output}`.slice(-20000);
      session.lastActive = Date.now();
      console.log(`[Nexus] Output from worker=${data.workerId} session=${sessionId} len=${msg.output.length}`);
      const subs = sessionSubscribers.get(sessionId);
      if (subs && subs.size > 0) {
        io.to(Array.from(subs)).emit('output', {
          workerId: data.workerId,
          sessionId,
          data: msg.output
        });
      }
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
    
    socket.on('subscribe', (msg: { workerId: string }) => {
        if (data.role !== 'client' || !data.user) return;
        if (WorkerModel.hasAccess(data.user.userId, msg.workerId, 'view')) {
            socket.join(`worker:${msg.workerId}`);
        } else {
            socket.emit('error', 'Access denied');
        }
    });

    socket.on('join-session', (msg: { sessionId: string; workerId?: string; displayName?: string }) => {
      if (data.role !== 'client' || !data.user) return;
      const sessionId = normalizeSessionId(msg.sessionId || socket.id);
      addSessionSubscriber(sessionId, socket.id);
      const workerId = msg.workerId || Array.from(activeSessions.values()).find(s => s.id === sessionId)?.workerId;
      if (workerId && WorkerModel.hasAccess(data.user.userId, workerId, 'view')) {
        const session = ensureActiveSession(workerId, sessionId, msg.displayName);
        session.lastActive = Date.now();
      }
      broadcastSessionList();
    });

    socket.on('leave-session', (msg: { sessionId: string }) => {
      const sessionId = normalizeSessionId(msg.sessionId || socket.id);
      removeSessionSubscriber(sessionId, socket.id);
    });

    socket.on('get-session-output', (msg: { sessionId: string }, cb?: (output: string) => void) => {
      if (data.role !== 'client' || !data.user) return;
      const sessionId = normalizeSessionId(msg.sessionId);
      const session = Array.from(activeSessions.values()).find(s => s.id === sessionId && WorkerModel.hasAccess(data.user!.userId, s.workerId, 'view'));
      if (cb) {
        cb(session?.output || '');
      }
    });
  });
  
  return io;
};
