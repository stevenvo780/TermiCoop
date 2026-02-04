import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import authReducer from './slices/authSlice';
import connectionReducer from './slices/connectionSlice';
import workersReducer from './slices/workersSlice';
import sessionsReducer from './slices/sessionsSlice';
import uiReducer from './slices/uiSlice';
import commandsReducer from './slices/commandsSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  connection: connectionReducer,
  workers: workersReducer,
  sessions: sessionsReducer,
  ui: uiReducer,
  commands: commandsReducer,
});

const persistConfig = {
  key: 'ultimate-terminal',
  version: 1,
  storage,
  whitelist: ['auth', 'sessions', 'workers', 'commands'],
  // Blacklist UI states that shouldn't persist across reloads
  blacklist: ['connection', 'ui'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Re-export all slice actions and selectors for easier imports
export * from './slices/authSlice';
export * from './slices/connectionSlice';
export * from './slices/workersSlice';
export * from './slices/sessionsSlice';
export * from './slices/uiSlice';
export * from './slices/commandsSlice';
