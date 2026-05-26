import { create } from 'zustand';
import type { AppUser } from '../types';

interface AuthState {
  user: AppUser | null;
  otherUser: AppUser | null;
  setUser: (user: AppUser | null) => void;
  setOtherUser: (user: AppUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  otherUser: null,
  setUser: (user) => set({ user }),
  setOtherUser: (otherUser) => set({ otherUser }),
  logout: () => set({ user: null, otherUser: null }),
}));
