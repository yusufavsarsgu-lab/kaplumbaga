import { dictionary, type DictionaryEntry } from './dictionary';

export type Lang = 'tr' | 'th';
export type TranslationStatus = 'translated' | 'fallback';
export type TranslationProvider = 'local' | 'mymemory' | 'libretranslate' | 'fallback';

export interface TranslationOutcome {
  originalText: string;
  translatedText: string;
  sourceLang: Lang;
  targetLang: Lang;
  status: TranslationStatus;
  provider: TranslationProvider;
}

export interface Translator {
  translate(text: string, sourceLang: Lang, targetLang: Lang): Promise<TranslationOutcome>;
}

// Emoji + Variation Selector + ZWJ + Symbol/Pictograph kaldırıcı.
// Modern V8/Node 20+ Unicode property escapes destekler.
const EMOJI_REGEX =
  /[\u200D\uFE0F\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

// Hem ASCII hem CJK noktalama: . , ! ? ; : "/' kapatma karakterleri vs.
const PUNCT_REGEX = /[\.,!?;:"'`~()\[\]{}<>«»“”‘’\-–—_*\/\\。、！？；：…]/g;

function normalize(text: string): string {
  return text
    .normalize('NFC')
    .replace(EMOJI_REGEX, ' ')
    .replace(PUNCT_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

class LocalTranslationService implements Translator {
  private readonly lookup = new Map<string, DictionaryEntry>();
  private readonly normalizedEntries: Array<{ key: string; entry: DictionaryEntry }> = [];

  constructor(entries: DictionaryEntry[]) {
    const register = (raw: string, entry: DictionaryEntry) => {
      const key = normalize(raw);
      if (!key) return;
      if (!this.lookup.has(key)) this.lookup.set(key, entry);
      this.normalizedEntries.push({ key, entry });
    };

    for (const entry of entries) {
      register(entry.tr, entry);
      register(entry.th, entry);
      for (const alias of entry.aliases || []) register(alias, entry);
    }

    // Daha uzun anahtarları önce dene (substring eşleşmesinde "Seni seviyorum"
    // "Ben seni çok seviyorum"'dan önce gelmesin diye uzunlukla sırala).
    this.normalizedEntries.sort((a, b) => b.key.length - a.key.length);
  }

  async translate(text: string, sourceLang: Lang, targetLang: Lang): Promise<TranslationOutcome> {
    const trimmed = text.trim();
    if (!trimmed || sourceLang === targetLang) {
      return {
        originalText: text,
        translatedText: text,
        sourceLang,
        targetLang,
        status: sourceLang === targetLang ? 'translated' : 'fallback',
        provider: sourceLang === targetLang ? 'local' : 'fallback',
      };
    }

    const normalizedInput = normalize(trimmed);

    // 1) Tam eşleşme
    let entry = this.lookup.get(normalizedInput);

    // 2) Substring eşleşmesi (uzun cümle içinde dictionary entry geçiyorsa)
    if (!entry) {
      for (const candidate of this.normalizedEntries) {
        if (candidate.key && normalizedInput.includes(candidate.key)) {
          entry = candidate.entry;
          break;
        }
      }
    }

    if (!entry) {
      return {
        originalText: text,
        translatedText: text,
        sourceLang,
        targetLang,
        status: 'fallback',
        provider: 'fallback',
      };
    }

    return {
      originalText: text,
      translatedText: targetLang === 'tr' ? entry.tr : entry.th,
      sourceLang,
      targetLang,
      status: 'translated',
      provider: 'local',
    };
  }
}

class MyMemoryTranslationService implements Translator {
  async translate(text: string, sourceLang: Lang, targetLang: Lang): Promise<TranslationOutcome> {
    const trimmed = text.trim();
    if (!trimmed || sourceLang === targetLang) {
      return {
        originalText: text,
        translatedText: text,
        sourceLang,
        targetLang,
        status: sourceLang === targetLang ? 'translated' : 'fallback',
        provider: sourceLang === targetLang ? 'local' : 'fallback',
      };
    }

    try {
      let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${sourceLang}|${targetLang}`;
      const email = process.env.MYMEMORY_EMAIL?.trim();
      if (email) {
        url += `&de=${encodeURIComponent(email)}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = (await response.json()) as {
        responseData?: { translatedText?: string };
        responseStatus?: number;
      };

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const translated = data.responseData.translatedText.trim();
        if (translated && translated.toLowerCase() !== trimmed.toLowerCase()) {
          return {
            originalText: text,
            translatedText: translated,
            sourceLang,
            targetLang,
            status: 'translated',
            provider: 'mymemory',
          };
        }
      }
    } catch {
      // MyMemory hatası, sonraki provider denenecek
    }

    return {
      originalText: text,
      translatedText: text,
      sourceLang,
      targetLang,
      status: 'fallback',
      provider: 'fallback',
    };
  }
}

class LibreTranslateTranslationService implements Translator {
  async translate(text: string, sourceLang: Lang, targetLang: Lang): Promise<TranslationOutcome> {
    const trimmed = text.trim();
    if (!trimmed || sourceLang === targetLang) {
      return {
        originalText: text,
        translatedText: text,
        sourceLang,
        targetLang,
        status: sourceLang === targetLang ? 'translated' : 'fallback',
        provider: sourceLang === targetLang ? 'local' : 'fallback',
      };
    }

    try {
      const baseUrl = process.env.LIBRETRANSLATE_URL?.trim() || 'https://libretranslate.com';
      const apiKey = process.env.LIBRETRANSLATE_API_KEY?.trim();

      const body: Record<string, unknown> = {
        q: trimmed,
        source: sourceLang,
        target: targetLang,
        format: 'text',
      };
      if (apiKey) {
        body.api_key = apiKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${baseUrl}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = (await response.json()) as {
        translatedText?: string;
      };

      const translated = data.translatedText?.trim();
      if (translated && translated.toLowerCase() !== trimmed.toLowerCase()) {
        return {
          originalText: text,
          translatedText: translated,
          sourceLang,
          targetLang,
          status: 'translated',
          provider: 'libretranslate',
        };
      }
    } catch {
      // LibreTranslate hatası
    }

    return {
      originalText: text,
      translatedText: text,
      sourceLang,
      targetLang,
      status: 'fallback',
      provider: 'fallback',
    };
  }
}

class FreeTranslationService implements Translator {
  private readonly local = new LocalTranslationService(dictionary);
  private readonly mymemory = new MyMemoryTranslationService();
  private readonly libre = new LibreTranslateTranslationService();

  async translate(text: string, sourceLang: Lang, targetLang: Lang): Promise<TranslationOutcome> {
    const trimmed = text.trim();
    if (!trimmed || sourceLang === targetLang) {
      return {
        originalText: text,
        translatedText: text,
        sourceLang,
        targetLang,
        status: sourceLang === targetLang ? 'translated' : 'fallback',
        provider: sourceLang === targetLang ? 'local' : 'fallback',
      };
    }

    // 1. Local dictionary (hızlı, offline)
    const localResult = await this.local.translate(text, sourceLang, targetLang);
    if (localResult.status === 'translated') {
      return localResult;
    }

    // 2. MyMemory API
    const mymemoryResult = await this.mymemory.translate(text, sourceLang, targetLang);
    if (mymemoryResult.status === 'translated') {
      return mymemoryResult;
    }

    // 3. LibreTranslate API
    const libreResult = await this.libre.translate(text, sourceLang, targetLang);
    if (libreResult.status === 'translated') {
      return libreResult;
    }

    // 4. Fallback
    return {
      originalText: text,
      translatedText: text,
      sourceLang,
      targetLang,
      status: 'fallback',
      provider: 'fallback',
    };
  }
}

function createTranslationService(): Translator {
  return new FreeTranslationService();
}

export const translationService: Translator = createTranslationService();

export function translateText(text: string, sourceLang: Lang, targetLang: Lang): Promise<TranslationOutcome> {
  return translationService.translate(text, sourceLang, targetLang);
}

export function autoTranslate(text: string, fromLang: Lang): Promise<TranslationOutcome> {
  const targetLang: Lang = fromLang === 'tr' ? 'th' : 'tr';
  return translateText(text, fromLang, targetLang);
}
