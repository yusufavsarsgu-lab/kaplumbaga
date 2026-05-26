import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppUser } from '../types';

interface AuthState {
  user: AppUser | null;
  otherUser: AppUser | null;
  token: string | null;
  setSession: (user: AppUser, otherUser: AppUser | null, token: string) => void;
  setUser: (user: AppUser | null) => void;
  setOtherUser: (user: AppUser | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      otherUser: null,
      token: null,
      setSession: (user, otherUser, token) => set({ user, otherUser, token }),
      setUser: (user) => set({ user }),
      setOtherUser: (otherUser) => set({ otherUser }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, otherUser: null, token: null }),
    }),
    {
      name: 'kaplumbaga-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        otherUser: state.otherUser,
        token: state.token,
      }),
    }
  )
);
