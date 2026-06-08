import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import type { AppUser, RoleCode } from '@/types';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function useAuthProvider(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  const ensurePublicUser = useCallback(async (): Promise<AppUser | null> => {
    const { data, error } = await supabase.rpc('ensure_public_user');
    if (error) {
      console.error('ensure_public_user failed:', error);
      return null;
    }
    return data as AppUser;
  }, []);

  const loadUser = useCallback(async (session: Session | null) => {
    if (!session) {
      setState({ user: null, session: null, loading: false });
      return;
    }

    const appUser = await ensurePublicUser();
    setState({ user: appUser, session, loading: false });
  }, [ensurePublicUser]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUser(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        loadUser(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ user: null, session: null, loading: false });
  }, []);

  return {
    ...state,
    signIn,
    signOut,
  };
}

export function hasAccess(role: RoleCode | null | undefined, path: string): boolean {
  if (!role) return false;
  const accessMap: Record<string, string[]> = {
    admin: ['/dashboard', '/partners', '/orders', '/confirmed', '/pos', '/receiving', '/delivery'],
    sales: ['/dashboard', '/partners', '/orders', '/confirmed', '/delivery'],
    purchasing: ['/dashboard', '/partners', '/pos', '/receiving'],
    support: ['/dashboard', '/partners', '/orders', '/confirmed', '/pos', '/receiving', '/delivery'],
  };
  const allowed = accessMap[role];
  return allowed?.some(p => path.startsWith(p)) ?? false;
}
