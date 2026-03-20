import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface StoredSession {
  id: string;
  workerId: string;
  workerName: string;
  workerKey: string;
  displayName: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface ServerSession {
  id: string;
  workerId: string;
  workerName: string;
  workerKey: string;
  displayName: string;
  createdAt: number;
  lastActiveAt: number;
  creatorUserId?: number;
}

const SESSION_STORE_KEY = 'ut-sessions-v1';
const SESSION_OUTPUT_KEY = 'ut-session-output-v1';
const ACTIVE_SESSION_KEY = 'ut-active-session';
const GRID_SLOTS_KEY = 'ut-grid-slots-v1';
const LAST_WORKER_KEY = 'ut-last-worker';

const parseStored = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

interface SessionsState {
  sessions: StoredSession[];
  activeSessionId: string | null;
  offlineSessionIds: string[];
  gridSessionIds: string[];
  sessionOutput: Record<string, string>;
  lastWorkerKey: string | null;
  isRestored: boolean;
  draggingSessionId: string | null;
  serverSessions: ServerSession[];
}

const initialState: SessionsState = {
  sessions: parseStored<StoredSession[]>(localStorage.getItem(SESSION_STORE_KEY), []),
  activeSessionId: localStorage.getItem(ACTIVE_SESSION_KEY),
  offlineSessionIds: [],
  gridSessionIds: parseStored<string[]>(localStorage.getItem(GRID_SLOTS_KEY), []).filter(Boolean),
  sessionOutput: parseStored<Record<string, string>>(localStorage.getItem(SESSION_OUTPUT_KEY), {}),
  lastWorkerKey: localStorage.getItem(LAST_WORKER_KEY),
  isRestored: false,
  draggingSessionId: null,
  serverSessions: [],
};

const emptyState: SessionsState = {
  sessions: [],
  activeSessionId: null,
  offlineSessionIds: [],
  gridSessionIds: [],
  sessionOutput: {},
  lastWorkerKey: null,
  isRestored: false,
  draggingSessionId: null,
  serverSessions: [],
};

const sessionsSlice = createSlice({
  name: 'sessions',
  initialState,
  reducers: {
    addSession: (state, action: PayloadAction<StoredSession>) => {
      const exists = state.sessions.find(s => s.id === action.payload.id);
      if (!exists) {
        state.sessions.push(action.payload);
        localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(state.sessions));
      }
    },
    removeSession: (state, action: PayloadAction<string>) => {
      state.sessions = state.sessions.filter(s => s.id !== action.payload);
      state.gridSessionIds = state.gridSessionIds.filter(id => id && id !== action.payload);
      delete state.sessionOutput[action.payload];
      if (state.activeSessionId === action.payload) {
        state.activeSessionId = state.sessions.length > 0 ? state.sessions[state.sessions.length - 1].id : null;
      }
      localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(state.sessions));
      localStorage.setItem(SESSION_OUTPUT_KEY, JSON.stringify(state.sessionOutput));
      localStorage.setItem(GRID_SLOTS_KEY, JSON.stringify(state.gridSessionIds));
    },
    updateSession: (state, action: PayloadAction<Partial<StoredSession> & { id: string }>) => {
      const session = state.sessions.find(s => s.id === action.payload.id);
      if (session) {
        Object.assign(session, action.payload);
        localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(state.sessions));
      }
    },
    moveSession: (state, action: PayloadAction<{ sessionId: string; targetSessionId?: string; position?: 'before' | 'after' | 'end' }>) => {
      const { sessionId, targetSessionId, position = 'before' } = action.payload;
      const sourceIndex = state.sessions.findIndex((s) => s.id === sessionId);
      if (sourceIndex < 0) return;

      // Move to end
      if (!targetSessionId || position === 'end') {
        const nextSessions = [...state.sessions];
        const [movedSession] = nextSessions.splice(sourceIndex, 1);
        if (!movedSession) return;
        nextSessions.push(movedSession);
        state.sessions = nextSessions;
        localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(state.sessions));
        return;
      }

      // Swap positions
      const targetIndex = state.sessions.findIndex((s) => s.id === targetSessionId);
      if (targetIndex < 0 || sourceIndex === targetIndex) return;

      const nextSessions = [...state.sessions];
      const temp = nextSessions[sourceIndex];
      nextSessions[sourceIndex] = nextSessions[targetIndex];
      nextSessions[targetIndex] = temp;
      state.sessions = nextSessions;
      localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(state.sessions));
    },
    setActiveSession: (state, action: PayloadAction<string | null>) => {
      state.activeSessionId = action.payload;
      if (action.payload) {
        localStorage.setItem(ACTIVE_SESSION_KEY, action.payload);
        const session = state.sessions.find(s => s.id === action.payload);
        if (session) {
          state.lastWorkerKey = session.workerKey;
          localStorage.setItem(LAST_WORKER_KEY, session.workerKey);
        }
      } else {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    },
    setOfflineSessionIds: (state, action: PayloadAction<string[]>) => {
      state.offlineSessionIds = action.payload;
    },
    setGridSessionIds: (state, action: PayloadAction<string[]>) => {
      state.gridSessionIds = action.payload.filter(Boolean);
      localStorage.setItem(GRID_SLOTS_KEY, JSON.stringify(state.gridSessionIds));
    },
    assignGridSlot: (state, action: PayloadAction<{ slotIndex: number; sessionId: string }>) => {
      const { slotIndex, sessionId } = action.payload;
      const nextSlots = state.gridSessionIds.filter((id) => id && id !== sessionId);
      const boundedIndex = Math.max(0, Math.min(slotIndex, nextSlots.length));
      nextSlots.splice(boundedIndex, 0, sessionId);
      state.gridSessionIds = nextSlots;
      if (state.gridSessionIds.length === 1) {
        state.gridSessionIds = [sessionId];
      }
      state.activeSessionId = sessionId;
      localStorage.setItem(GRID_SLOTS_KEY, JSON.stringify(state.gridSessionIds));
      localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    },
    swapGridSlots: (state, action: PayloadAction<{ slotIndex: number; sessionId: string }>) => {
      const { slotIndex, sessionId } = action.payload;
      // Find where the dragged session currently is in the grid
      const sourceIndex = state.gridSessionIds.findIndex((id) => id === sessionId);
      if (sourceIndex >= 0 && slotIndex < state.gridSessionIds.length) {
        // Both are in grid → swap them
        const temp = state.gridSessionIds[slotIndex];
        state.gridSessionIds[slotIndex] = sessionId;
        state.gridSessionIds[sourceIndex] = temp;
      } else if (sourceIndex < 0 && slotIndex < state.gridSessionIds.length) {
        // Dragged session is NOT in grid, target slot IS occupied → replace
        state.gridSessionIds[slotIndex] = sessionId;
      } else {
        // Fallback: just add at the end
        state.gridSessionIds = state.gridSessionIds.filter((id) => id && id !== sessionId);
        state.gridSessionIds.push(sessionId);
      }
      state.activeSessionId = sessionId;
      localStorage.setItem(GRID_SLOTS_KEY, JSON.stringify(state.gridSessionIds));
      localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    },
    updateSessionOutput: (state, action: PayloadAction<{ sessionId: string; output: string }>) => {
      const MAX_OUTPUT_CHARS = 20000;
      const current = state.sessionOutput[action.payload.sessionId] || '';
      state.sessionOutput[action.payload.sessionId] = `${current}${action.payload.output}`.slice(-MAX_OUTPUT_CHARS);
    },
    setSessionOutput: (state, action: PayloadAction<{ sessionId: string; output: string }>) => {
      state.sessionOutput[action.payload.sessionId] = action.payload.output;
    },
    setIsRestored: (state, action: PayloadAction<boolean>) => {
      state.isRestored = action.payload;
    },
    setDraggingSessionId: (state, action: PayloadAction<string | null>) => {
      state.draggingSessionId = action.payload;
    },
    clearAllSessions: (state) => {
      state.sessions = [];
      state.activeSessionId = null;
      state.offlineSessionIds = [];
      state.sessionOutput = {};
      localStorage.removeItem(SESSION_STORE_KEY);
      localStorage.removeItem(SESSION_OUTPUT_KEY);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    },
    resetSessionsState: (state) => {
      Object.assign(state, emptyState);
      localStorage.removeItem(SESSION_STORE_KEY);
      localStorage.removeItem(SESSION_OUTPUT_KEY);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem(GRID_SLOTS_KEY);
      localStorage.removeItem(LAST_WORKER_KEY);
    },
    setSessions: (state, action: PayloadAction<StoredSession[]>) => {
      state.sessions = action.payload;
      localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(state.sessions));
    },
    setServerSessions: (state, action: PayloadAction<ServerSession[]>) => {
      state.serverSessions = action.payload;
    },
  },
});

export const {
  addSession,
  removeSession,
  updateSession,
  moveSession,
  setActiveSession,
  setOfflineSessionIds,
  setGridSessionIds,
  assignGridSlot,
  swapGridSlots,
  updateSessionOutput,
  setSessionOutput,
  setIsRestored,
  setDraggingSessionId,
  clearAllSessions,
  resetSessionsState,
  setSessions,
  setServerSessions,
} = sessionsSlice.actions;

export default sessionsSlice.reducer;

// Selectors
export const selectActiveSession = (state: { sessions: SessionsState }) => {
  return state.sessions.sessions.find(s => s.id === state.sessions.activeSessionId) || null;
};

export const selectIsSessionOffline = (state: { sessions: SessionsState }, sessionId: string) => {
  return state.sessions.offlineSessionIds.includes(sessionId);
};
