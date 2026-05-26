import { getBundle } from '../i18n';
import type { Language } from '../types';

export function getQuickMessages(lang: Language): { label: string; text: string }[] {
  return getBundle(lang).quickMessages;
}
