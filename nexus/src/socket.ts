import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import { verifyToken, JwtPayload } from './utils/jwt';
import { WorkerModel, Worker } from './models/worker.model';
import db from './config/database';

interface SocketData {
  role: 'client' | 'worker';
  user?: JwtPayload;
  workerId?: string; // If role is worker
}

// In-memory state
export const workers: Map<string, Worker & { socketId: string }> = new Map();

interface ActiveSession {
  id: string;
  workerId: string;
  output: string;
  lastActive: number;
  debounceTimer?: NodeJS.Timeout;
}
const activeSessions: Map<string, ActiveSession> = new Map();

export const initSocket = (httpServer: any) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Helper to broadcast worker updates to all connected clients
  const broadcastWorkerUpdates = () => {
    io.sockets.sockets.forEach((socket) => {
      const socketData = socket.data as SocketData;
      if (socketData.role === 'client' && socketData.user) {
        const list = WorkerModel.getAccessibleWorkers(socketData.user.userId);
        socket.emit('workers', list);
      }
    });
  };

  io.use(async (socket, next) => {
    const { token, type, apiKey } = (socket.handshake.auth || {}) as any;
    
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
        
        socket.data = { role: 'worker', workerId: worker.id } as SocketData;
        
        // Register worker in memory immediately
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

    // Worker Life-cycle
    if (data.role === 'worker' && data.workerId) {
        console.log(`Worker ${data.workerId} connected`);
        broadcastWorkerUpdates();
    }
    
    // Client Life-cycle
    if (data.role === 'client' && data.user) {
        // Send initial list
        const list = WorkerModel.getAccessibleWorkers(data.user.userId);
        socket.emit('workers', list);
    }

    socket.on('disconnect', () => {
       if (data.role === 'worker' && data.workerId) {
           workers.delete(data.workerId);
           WorkerModel.updateStatus(data.workerId, 'offline');
           console.log(`Worker ${data.workerId} disconnected`);
           broadcastWorkerUpdates();
       }
    });

    // Client Commands
    socket.on('execute', async (msg: { workerId: string; command: string; sessionId?: string }) => {
       if (data.role !== 'client' || !data.user) return;
       
       if (!WorkerModel.hasAccess(data.user.userId, msg.workerId, 'control')) {
           socket.emit('error', 'Access denied to worker');
           return;
       }
       
       const worker = workers.get(msg.workerId);
       if (!worker) {
           socket.emit('error', 'Worker is offline');
           return;
       }
       
       // Send to worker
       io.to(worker.socketId).emit('execute', {
           clientId: socket.id,
           command: msg.command,
           sessionId: msg.sessionId || 'default'
       });
    });
    
    // Output from worker
    socket.on('output', (msg: { sessionId?: string; output: string }) => {
        if (data.role !== 'worker' || !data.workerId) return;
        
        io.to(`worker:${data.workerId}`).emit('output', {
            workerId: data.workerId,
            sessionId: msg.sessionId,
            data: msg.output
        });
    });
    
    // Client joining room
    socket.on('subscribe', (msg: { workerId: string }) => {
        if (data.role !== 'client' || !data.user) return;
        if (WorkerModel.hasAccess(data.user.userId, msg.workerId, 'view')) {
            socket.join(`worker:${msg.workerId}`);
        } else {
            socket.emit('error', 'Access denied');
        }
    });
  });
  
  return io;
};
