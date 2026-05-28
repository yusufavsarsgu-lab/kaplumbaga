import { create } from 'zustand';

export interface Story {
  id: string;
  userId: string;
  mediaData: string;
  type: string;
  caption?: string | null;
  createdAt: string;
  viewed: boolean;
  userName?: string;
  userAvatar?: string | null;
}

interface StoryState {
  stories: Story[];
  setStories: (stories: Story[]) => void;
  markViewed: (storyId: string) => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  stories: [],
  setStories: (stories) => set({ stories }),
  markViewed: (storyId) =>
    set((state) => ({
      stories: state.stories.map((s) =>
        s.id === storyId ? { ...s, viewed: true } : s
      ),
    })),
}));
