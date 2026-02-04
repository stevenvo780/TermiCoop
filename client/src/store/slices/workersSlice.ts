import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Worker {
  id: string;
  socketId: string;
  name: string;
  status?: 'online' | 'offline';
  lastSeen?: string;
  api_key?: string;
  permission?: 'view' | 'control' | 'admin';
}

const WORKER_TAGS_KEY = 'ut-worker-tags';
const WORKER_GROUPING_KEY = 'ut-worker-grouping';

interface WorkersState {
  workers: Worker[];
  workerTags: Record<string, string[]>;
  workerQuery: string;
  workerGrouping: 'none' | 'tag';
}

const parseStored = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const initialState: WorkersState = {
  workers: [],
  workerTags: parseStored<Record<string, string[]>>(localStorage.getItem(WORKER_TAGS_KEY), {}),
  workerQuery: '',
  workerGrouping: parseStored<string>(localStorage.getItem(WORKER_GROUPING_KEY), 'none') === 'tag' ? 'tag' : 'none',
};

const emptyState: WorkersState = {
  workers: [],
  workerTags: {},
  workerQuery: '',
  workerGrouping: 'none',
};

const workersSlice = createSlice({
  name: 'workers',
  initialState,
  reducers: {
    setWorkers: (state, action: PayloadAction<Worker[]>) => {
      state.workers = action.payload;
    },
    addWorker: (state, action: PayloadAction<Worker>) => {
      const exists = state.workers.find(w => w.id === action.payload.id);
      if (!exists) {
        state.workers.push(action.payload);
      }
    },
    removeWorker: (state, action: PayloadAction<string>) => {
      state.workers = state.workers.filter(w => w.id !== action.payload);
    },
    updateWorkerStatus: (state, action: PayloadAction<{ id: string; status: 'online' | 'offline' }>) => {
      const worker = state.workers.find(w => w.id === action.payload.id);
      if (worker) {
        worker.status = action.payload.status;
      }
    },
    setWorkerTags: (state, action: PayloadAction<Record<string, string[]>>) => {
      state.workerTags = action.payload;
      localStorage.setItem(WORKER_TAGS_KEY, JSON.stringify(action.payload));
    },
    updateWorkerTags: (state, action: PayloadAction<{ workerKey: string; tags: string[] }>) => {
      state.workerTags[action.payload.workerKey] = action.payload.tags;
      localStorage.setItem(WORKER_TAGS_KEY, JSON.stringify(state.workerTags));
    },
    setWorkerQuery: (state, action: PayloadAction<string>) => {
      state.workerQuery = action.payload;
    },
    setWorkerGrouping: (state, action: PayloadAction<'none' | 'tag'>) => {
      state.workerGrouping = action.payload;
      localStorage.setItem(WORKER_GROUPING_KEY, JSON.stringify(action.payload));
    },
    resetWorkersState: (state) => {
      Object.assign(state, emptyState);
      localStorage.removeItem(WORKER_TAGS_KEY);
      localStorage.removeItem(WORKER_GROUPING_KEY);
    },
  },
});

export const {
  setWorkers,
  addWorker,
  removeWorker,
  updateWorkerStatus,
  setWorkerTags,
  updateWorkerTags,
  setWorkerQuery,
  setWorkerGrouping,
  resetWorkersState,
} = workersSlice.actions;

export default workersSlice.reducer;

// Selectors
export const selectFilteredWorkers = (state: { workers: WorkersState }) => {
  const { workers, workerQuery, workerTags } = state.workers;
  const search = workerQuery.trim().toLowerCase();

  if (!search) return workers;

  return workers.filter((worker) => {
    const workerKey = worker.name.trim().toLowerCase();
    const tags = workerTags[workerKey] || [];
    return (
      worker.name.toLowerCase().includes(search) ||
      tags.some((tag) => tag.toLowerCase().includes(search))
    );
  });
};

export const selectGroupedWorkers = (state: { workers: WorkersState }) => {
  const filteredWorkers = selectFilteredWorkers(state);
  const { workerGrouping, workerTags } = state.workers;

  if (workerGrouping !== 'tag') {
    return { Todos: filteredWorkers };
  }

  return filteredWorkers.reduce((acc, worker) => {
    const workerKey = worker.name.trim().toLowerCase();
    const tags = workerTags[workerKey] || [];
    const groupLabel = tags[0] || 'Sin etiquetas';
    acc[groupLabel] = acc[groupLabel] || [];
    acc[groupLabel].push(worker);
    return acc;
  }, {} as Record<string, Worker[]>);
};
