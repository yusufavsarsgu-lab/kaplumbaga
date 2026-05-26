import type { Language } from '../types';

export interface QuickMessageItem {
  label: string;
  text: string;
}

export interface EmojiCategoryItem {
  id: string;
  label: string;
  emojis: string[];
}

export interface TranslationBundle {
  ui: Record<string, string>;
  quickMessages: QuickMessageItem[];
  emojiCategories: EmojiCategoryItem[];
}

export type UiLanguage = Language;
