import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'turtle';

interface SettingsState {
  theme: Theme;
  soundEnabled: boolean;
  messageSoundEnabled: boolean;
  typingIndicatorEnabled: boolean;
  showOriginal: boolean;
  showTranslation: boolean;
  setTheme: (theme: Theme) => void;
  toggleSound: () => void;
  toggleMessageSound: () => void;
  toggleTypingIndicator: () => void;
  toggleShowOriginal: () => void;
  toggleShowTranslation: () => void;
  reset: () => void;
}

const defaultSettings = {
  theme: 'light' as Theme,
  soundEnabled: true,
  messageSoundEnabled: true,
  typingIndicatorEnabled: true,
  showOriginal: true,
  showTranslation: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setTheme: (theme) => set({ theme }),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      toggleMessageSound: () => set((state) => ({ messageSoundEnabled: !state.messageSoundEnabled })),
      toggleTypingIndicator: () => set((state) => ({ typingIndicatorEnabled: !state.typingIndicatorEnabled })),
      toggleShowOriginal: () => set((state) => ({ showOriginal: !state.showOriginal })),
      toggleShowTranslation: () => set((state) => ({ showTranslation: !state.showTranslation })),
      reset: () => set(defaultSettings),
    }),
    { name: 'kaplumbaga-settings' }
  )
);
