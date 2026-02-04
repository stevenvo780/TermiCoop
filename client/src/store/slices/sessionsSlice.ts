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

const SESSION_STORE_KEY = 'ut-sessions-v1';
const SESSION_OUTPUT_KEY = 'ut-session-output-v1';
const ACTIVE_SESSION_KEY = 'ut-active-session';
const GRID_SLOTS_KEY = 'ut-grid-slots-v1';
const LAST_WORKER_KEY = 'ut-last-worker';
const LAYOUT_MODE_KEY = 'ut-layout-mode';

export type LayoutMode = 'single' | 'split-vertical' | 'quad';

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
  layoutMode: LayoutMode;
}

const initialState: SessionsState = {
  sessions: parseStored<StoredSession[]>(localStorage.getItem(SESSION_STORE_KEY), []),
  activeSessionId: localStorage.getItem(ACTIVE_SESSION_KEY),
  offlineSessionIds: [],
  gridSessionIds: parseStored<string[]>(localStorage.getItem(GRID_SLOTS_KEY), []).slice(0, 4),
  sessionOutput: parseStored<Record<string, string>>(localStorage.getItem(SESSION_OUTPUT_KEY), {}),
  lastWorkerKey: localStorage.getItem(LAST_WORKER_KEY),
  isRestored: false,
  draggingSessionId: null,
  layoutMode: (localStorage.getItem(LAYOUT_MODE_KEY) as LayoutMode) || 'single',
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
  layoutMode: 'single',
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
      state.gridSessionIds = state.gridSessionIds.map(id => id === action.payload ? '' : id);
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
      state.gridSessionIds = action.payload.slice(0, 4);
      localStorage.setItem(GRID_SLOTS_KEY, JSON.stringify(state.gridSessionIds));
    },
    assignGridSlot: (state, action: PayloadAction<{ slotIndex: number; sessionId: string }>) => {
      const { slotIndex, sessionId } = action.payload;
      // Ensure 4 slots
      while (state.gridSessionIds.length < 4) {
        state.gridSessionIds.push('');
      }
      // Clear ID from other slots
      for (let i = 0; i < 4; i++) {
        if (i !== slotIndex && state.gridSessionIds[i] === sessionId) {
          state.gridSessionIds[i] = '';
        }
      }
      state.gridSessionIds[slotIndex] = sessionId;
      state.activeSessionId = sessionId;
      localStorage.setItem(GRID_SLOTS_KEY, JSON.stringify(state.gridSessionIds));
      localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    },
    clearGrid: (state) => {
      state.gridSessionIds = [];
      localStorage.setItem(GRID_SLOTS_KEY, JSON.stringify([]));
    },
    updateSessionOutput: (state, action: PayloadAction<{ sessionId: string; output: string }>) => {
      const MAX_OUTPUT_CHARS = 20000;
      const current = state.sessionOutput[action.payload.sessionId] || '';
      state.sessionOutput[action.payload.sessionId] = `${current}${action.payload.output}`.slice(-MAX_OUTPUT_CHARS);
      localStorage.setItem(SESSION_OUTPUT_KEY, JSON.stringify(state.sessionOutput));
    },
    setSessionOutput: (state, action: PayloadAction<{ sessionId: string; output: string }>) => {
      state.sessionOutput[action.payload.sessionId] = action.payload.output;
      localStorage.setItem(SESSION_OUTPUT_KEY, JSON.stringify(state.sessionOutput));
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
      localStorage.removeItem(LAYOUT_MODE_KEY);
    },
    setSessions: (state, action: PayloadAction<StoredSession[]>) => {
      state.sessions = action.payload;
      localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(state.sessions));
    },
    setLayoutMode: (state, action: PayloadAction<LayoutMode>) => {
      state.layoutMode = action.payload;
      localStorage.setItem(LAYOUT_MODE_KEY, action.payload);
    },
  },
});

export const {
  addSession,
  removeSession,
  updateSession,
  setActiveSession,
  setOfflineSessionIds,
  setGridSessionIds,
  assignGridSlot,
  clearGrid,
  updateSessionOutput,
  setSessionOutput,
  setIsRestored,
  setDraggingSessionId,
  clearAllSessions,
  resetSessionsState,
  setSessions,
  setLayoutMode,
} = sessionsSlice.actions;

export default sessionsSlice.reducer;

// Selectors
export const selectActiveSession = (state: { sessions: SessionsState }) => {
  return state.sessions.sessions.find(s => s.id === state.sessions.activeSessionId) || null;
};

export const selectIsSessionOffline = (state: { sessions: SessionsState }, sessionId: string) => {
  return state.sessions.offlineSessionIds.includes(sessionId);
};
