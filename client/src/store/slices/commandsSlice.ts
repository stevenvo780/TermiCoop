import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface CommandSnippet {
  id: string;
  label: string;
  command: string;
}

const COMMAND_HISTORY_KEY = 'ut-command-history';
const COMMAND_SNIPPETS_KEY = 'ut-command-snippets';
const MAX_HISTORY_ITEMS = 60;

const parseStored = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

interface CommandsState {
  commandHistory: Record<string, string[]>;
  commandSnippets: Record<string, CommandSnippet[]>;
  commandTab: 'history' | 'snippets';
}

const initialState: CommandsState = {
  commandHistory: parseStored<Record<string, string[]>>(localStorage.getItem(COMMAND_HISTORY_KEY), {}),
  commandSnippets: parseStored<Record<string, CommandSnippet[]>>(localStorage.getItem(COMMAND_SNIPPETS_KEY), {}),
  commandTab: 'history',
};

const emptyState: CommandsState = {
  commandHistory: {},
  commandSnippets: {},
  commandTab: 'history',
};

const commandsSlice = createSlice({
  name: 'commands',
  initialState,
  reducers: {
    addCommandToHistory: (state, action: PayloadAction<{ workerKey: string; command: string }>) => {
      const { workerKey, command } = action.payload;
      const trimmed = command.trim();
      if (!trimmed) return;

      const existing = state.commandHistory[workerKey] || [];
      const next = [trimmed, ...existing.filter(item => item !== trimmed)].slice(0, MAX_HISTORY_ITEMS);
      state.commandHistory[workerKey] = next;
      localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(state.commandHistory));
    },
    clearHistory: (state, action: PayloadAction<string>) => {
      state.commandHistory[action.payload] = [];
      localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(state.commandHistory));
    },
    addSnippet: (state, action: PayloadAction<{ workerKey: string; snippet: CommandSnippet }>) => {
      const { workerKey, snippet } = action.payload;
      const existing = state.commandSnippets[workerKey] || [];
      state.commandSnippets[workerKey] = [snippet, ...existing];
      localStorage.setItem(COMMAND_SNIPPETS_KEY, JSON.stringify(state.commandSnippets));
    },
    removeSnippet: (state, action: PayloadAction<{ workerKey: string; snippetId: string }>) => {
      const { workerKey, snippetId } = action.payload;
      const existing = state.commandSnippets[workerKey] || [];
      state.commandSnippets[workerKey] = existing.filter(s => s.id !== snippetId);
      localStorage.setItem(COMMAND_SNIPPETS_KEY, JSON.stringify(state.commandSnippets));
    },
    setCommandTab: (state, action: PayloadAction<'history' | 'snippets'>) => {
      state.commandTab = action.payload;
    },
    resetCommandsState: (state) => {
      Object.assign(state, emptyState);
      localStorage.removeItem(COMMAND_HISTORY_KEY);
      localStorage.removeItem(COMMAND_SNIPPETS_KEY);
    },
  },
});

export const {
  addCommandToHistory,
  clearHistory,
  addSnippet,
  removeSnippet,
  setCommandTab,
  resetCommandsState,
} = commandsSlice.actions;

export default commandsSlice.reducer;

// Selectors
export const selectHistoryForWorker = (state: { commands: CommandsState }, workerKey: string) => {
  return state.commands.commandHistory[workerKey] || [];
};

export const selectSnippetsForWorker = (state: { commands: CommandsState }, workerKey: string) => {
  return state.commands.commandSnippets[workerKey] || [];
};
