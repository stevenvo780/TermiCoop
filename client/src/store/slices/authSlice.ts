import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface PlanLimits {
  maxWorkers: number;
  maxSessions: number;
  canShare: boolean;
  canSaveSnippets: boolean;
  canTagWorkers: boolean;
  canUseApi: boolean;
}

interface User {
  userId: number;
  username: string;
  isAdmin: boolean;
  plan?: string;
  limits?: PlanLimits;
}

interface AuthState {
  token: string | null;
  currentUser: User | null;
  authError: string | null;
  busy: boolean;
  needsSetup: boolean;
}

const AUTH_KEY = 'ut-token';

const initialState: AuthState = {
  token: localStorage.getItem(AUTH_KEY),
  currentUser: null,
  authError: null,
  busy: false,
  needsSetup: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken: (state, action: PayloadAction<string | null>) => {
      state.token = action.payload;
      if (action.payload) {
        localStorage.setItem(AUTH_KEY, action.payload);
      } else {
        localStorage.removeItem(AUTH_KEY);
      }
    },
    setCurrentUser: (state, action: PayloadAction<User | null>) => {
      state.currentUser = action.payload;
    },
    setAuthError: (state, action: PayloadAction<string | null>) => {
      state.authError = action.payload;
    },
    setBusy: (state, action: PayloadAction<boolean>) => {
      state.busy = action.payload;
    },
    setNeedsSetup: (state, action: PayloadAction<boolean>) => {
      state.needsSetup = action.payload;
    },
    clearAuth: (state, action: PayloadAction<string | undefined>) => {
      state.token = null;
      state.currentUser = null;
      state.authError = action.payload || null;
      localStorage.removeItem(AUTH_KEY);
    },
    loginSuccess: (state, action: PayloadAction<{ token: string; user: User }>) => {
      state.token = action.payload.token;
      state.currentUser = action.payload.user;
      state.authError = null;
      state.needsSetup = false;
      localStorage.setItem(AUTH_KEY, action.payload.token);
    },
  },
});

export const {
  setToken,
  setCurrentUser,
  setAuthError,
  setBusy,
  setNeedsSetup,
  clearAuth,
  loginSuccess,
} = authSlice.actions;

export default authSlice.reducer;
