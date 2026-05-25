import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useThreatStore } from './useThreatStore';

interface AuthState {
  session: Session | null;
  user: User | null;
  isInitialized: boolean;
  setSession: (session: Session | null) => void;
  signOut: () => Promise<void>;
  initializeAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isInitialized: false,
  setSession: (session) => set({ session, user: session?.user || null }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
  initializeAuth: () => {
    if (get().isInitialized) return;
    set({ isInitialized: true });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error during initialization:', error.message);
        supabase.auth.signOut().catch(() => {});
      }
      set({ session, user: session?.user || null });
      if (session?.user) {
        useThreatStore.getState().syncFromCloud();
      }

      // Limpiar el access_token de la URL también al recargar la página inicial
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
        setTimeout(() => {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }, 100);
      }
    });

    supabase.auth.onAuthStateChange((event, session) => {
      set({ session, user: session?.user || null });
      if (session?.user) {
        useThreatStore.getState().syncFromCloud();
      }

      // Limpiar el access_token de la URL por seguridad y estética después del login OAuth
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
        setTimeout(() => {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }, 100);
      }
    });
  }
}));
