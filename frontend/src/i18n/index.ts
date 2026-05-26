import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import type { Language } from '../types';
import { th } from './th';
import { tr } from './tr';
import type { TranslationBundle } from './types';

const bundles: Record<Language, TranslationBundle> = { tr, th };

export function resolveLanguage(language?: Language | null): Language {
  return language === 'th' ? 'th' : 'tr';
}

export function getBundle(language?: Language | null): TranslationBundle {
  return bundles[resolveLanguage(language)];
}

export function getT(language?: Language | null) {
  const activeBundle = getBundle(language);
  const fallbackBundle = getBundle('tr');

  return (key: string, params?: Record<string, string | number>) => {
    const template = activeBundle.ui[key] ?? fallbackBundle.ui[key] ?? key;

    if (!params) return template;

    return Object.entries(params).reduce(
      (text, [paramKey, value]) => text.split(`{{${paramKey}}}`).join(String(value)),
      template
    );
  };
}

export function useI18n(language?: Language | null) {
  const userLanguage = useAuthStore((state) => state.user?.language);
  const activeLanguage = resolveLanguage(language ?? userLanguage ?? 'tr');

  return useMemo(() => {
    const bundle = getBundle(activeLanguage);
    return {
      language: activeLanguage,
      t: getT(activeLanguage),
      quickMessages: bundle.quickMessages,
      emojiCategories: bundle.emojiCategories,
    };
  }, [activeLanguage]);
}

export type { EmojiCategoryItem, QuickMessageItem, TranslationBundle } from './types';
