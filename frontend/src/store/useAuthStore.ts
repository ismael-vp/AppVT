import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useThreatStore } from './useThreatStore';

interface AuthState {
  session: Session | null;
  user: User | null;
  setSession: (session: Session | null) => void;
  signOut: () => Promise<void>;
  initializeAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  setSession: (session) => set({ session, user: session?.user || null }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
  initializeAuth: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, user: session?.user || null });
      if (session?.user) {
        useThreatStore.getState().syncFromCloud();
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user || null });
      if (session?.user) {
        useThreatStore.getState().syncFromCloud();
      }
    });
  }
}));
