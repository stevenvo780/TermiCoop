import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setToken,
  setAuthError,
  setBusy,
  setNeedsSetup,
  clearAuth,
  loginSuccess,
} from '../store';
import { NEXUS_URL } from './useSocket';

interface UseAuthReturn {
  token: string | null;
  currentUser: { userId: number; username: string; isAdmin: boolean } | null;
  authError: string | null;
  busy: boolean;
  needsSetup: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  setup: (password: string, setupToken?: string) => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  const dispatch = useAppDispatch();
  const { token, currentUser, authError, busy, needsSetup } = useAppSelector((state) => state.auth);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    dispatch(setAuthError(null));
    dispatch(setBusy(true));

    try {
      const response = await fetch(`${NEXUS_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          throw new Error(
            response.status === 401 ? 'Credenciales incorrectas' :
              response.status === 404 ? 'Servidor no encontrado' :
                `Error del servidor (${response.status})`
          );
        }
        throw new Error('Respuesta inválida del servidor');
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Credenciales incorrectas');
      }

      dispatch(loginSuccess({ token: data.token, user: data.user }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de autenticación';
      dispatch(setAuthError(message));
      return false;
    } finally {
      dispatch(setBusy(false));
    }
  }, [dispatch]);

  const register = useCallback(async (username: string, password: string): Promise<boolean> => {
    dispatch(setAuthError(null));
    dispatch(setBusy(true));

    try {
      const response = await fetch(`${NEXUS_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          throw new Error(
            response.status === 403 ? 'Registro no permitido' :
              response.status === 404 ? 'Servidor no encontrado' :
                `Error del servidor (${response.status})`
          );
        }
        throw new Error('Respuesta inválida del servidor');
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error en registro');
      }

      dispatch(loginSuccess({ token: data.token, user: data.user }));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de registro';
      dispatch(setAuthError(message));
      return false;
    } finally {
      dispatch(setBusy(false));
    }
  }, [dispatch]);

  const logout = useCallback(() => {
    dispatch(clearAuth());
  }, [dispatch]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (!token) return false;

    dispatch(setBusy(true));
    dispatch(setAuthError(null));

    try {
      const res = await fetch(`${NEXUS_URL}/api/auth/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Password change failed');
      }
      return true;
    } catch (err: unknown) {
      dispatch(setAuthError(err instanceof Error ? err.message : 'Error desconocido'));
      return false;
    } finally {
      dispatch(setBusy(false));
    }
  }, [token, dispatch]);

  const setup = useCallback(async (password: string, setupToken?: string): Promise<boolean> => {
    dispatch(setBusy(true));
    dispatch(setAuthError(null));

    try {
      const payload: { password: string; setupToken?: string } = { password };
      if (setupToken) {
        payload.setupToken = setupToken;
      }

      const res = await fetch(`${NEXUS_URL}/api/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Setup failed');
      }

      const data = await res.json();
      dispatch(setToken(data.token));
      dispatch(setNeedsSetup(false));
      return true;
    } catch (err: unknown) {
      dispatch(setAuthError(err instanceof Error ? err.message : 'Error desconocido'));
      return false;
    } finally {
      dispatch(setBusy(false));
    }
  }, [dispatch]);

  return {
    token,
    currentUser,
    authError,
    busy,
    needsSetup,
    login,
    register,
    logout,
    changePassword,
    setup,
  };
}
