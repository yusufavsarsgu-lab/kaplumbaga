import { dictionary, type DictionaryEntry } from './dictionary';

export type Lang = 'tr' | 'th';
export type TranslationStatus = 'translated' | 'fallback' | 'failed';
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

function getLibreTranslateConfig(): { baseUrl: string; apiKey: string | undefined } {
  const baseUrl =
    process.env.LIBRETRANSLATE_URL?.trim() ||
    process.env.TRANSLATION_API_URL?.trim() ||
    'https://libretranslate.com';
  const apiKey =
    process.env.LIBRETRANSLATE_API_KEY?.trim() ||
    process.env.TRANSLATION_API_KEY?.trim() ||
    undefined;
  return { baseUrl, apiKey };
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
      const { baseUrl, apiKey } = getLibreTranslateConfig();

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

const MAX_CHUNK_LENGTH = 500;

export function detectLanguage(text: string): 'tr' | 'th' | 'unknown' {
  const trimmed = text.trim();
  if (!trimmed) return 'unknown';

  // Thai Unicode range: U+0E00 to U+0E7F
  const thaiRegex = /[\u0E00-\u0E7F]/;
  // Turkish-specific characters
  const turkishRegex = /[çğıöşüÇĞİÖŞÜâêîôûÂÊÎÔÛ]/;

  let thaiCount = 0;
  let turkishCount = 0;
  let totalLetters = 0;

  for (const char of trimmed) {
    if (/\p{L}/u.test(char)) {
      totalLetters++;
      if (thaiRegex.test(char)) thaiCount++;
      if (turkishRegex.test(char)) turkishCount++;
    }
  }

  if (totalLetters === 0) return 'unknown';

  if (thaiCount / totalLetters > 0.3) return 'th';
  if (turkishCount / totalLetters > 0.05) return 'tr';

  // If no distinctive characters, check if text contains common Thai words
  const thaiWordPatterns = /\b(ครับ|ค่ะ|สวัสดี|ขอบคุณ|ที่รัก|ฉัน|ผม|เธอ|เขา|เรา|ดี|รัก|กิน|ไป|มา|นี้|นั้น|อะไร|ทำไม|อย่างไร|ใช่|ไม่|มี|ไม่มี|ก็|แล้ว|แต่|หรือ|และ|กับ|ของ|ใน|ที่|จาก|ถึง|โดย|เมื่อ|ก่อน|หลัง|ขณะ|เพราะ|เพื่อ|ถ้า|ถึงแม้|แม้ว่า|อย่างไรก็ตาม|ดังนั้น|เพราะฉะนั้น)\b/;
  const turkishWordPatterns = /\b(merhaba|nasıl|teşekkür|evet|hayır|lütfen|affedersin|günaydın|iyi|akşamlar|güle|güle|hoş|geldiniz|hoşça|kal|selam|sevgi|saygı|mutlu|üzgün|yorgun|acıkmış|susamış|sıcak|soğuk|güzel|çirkin|büyük|küçük|uzun|kısa|hızlı|yavaş|yeni|eski|temiz|kirli|açık|kapalı|boş|dol|doğru|yanlış|kolay|zor|ucuz|pahalı|zengin|fakir|güçlü|zayıf|sağlıklı|hasta|mutluluk|hüzün|korku|cesaret|umut|hayal|gerçek|yalan|doğa|deniz|göl|nehir|dağ|ova|orman|çöl|gökyüzü|yıldız|ay|güneş|dünya|ü|ı|ö|ş|ğ|ç)\b/i;

  if (thaiWordPatterns.test(trimmed)) return 'th';
  if (turkishWordPatterns.test(trimmed)) return 'tr';

  return 'unknown';
}

export function splitLongText(text: string, maxLength = MAX_CHUNK_LENGTH): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return [trimmed];

  const chunks: string[] = [];
  let current = '';

  // Split by sentences first (. ! ?), then by spaces
  const sentences = trimmed.split(/([.!?]+\s*)/);
  for (const sentence of sentences) {
    if (!sentence) continue;
    if ((current + sentence).length <= maxLength) {
      current += sentence;
    } else {
      if (current) chunks.push(current.trim());
      // If single sentence is too long, split by spaces
      if (sentence.length > maxLength) {
        const words = sentence.split(/(\s+)/);
        current = '';
        for (const word of words) {
          if ((current + word).length <= maxLength) {
            current += word;
          } else {
            if (current.trim()) chunks.push(current.trim());
            current = word;
          }
        }
      } else {
        current = sentence;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [trimmed];
}

export async function translateLongText(
  text: string,
  sourceLang: Lang,
  targetLang: Lang
): Promise<TranslationOutcome> {
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

  const chunks = splitLongText(trimmed);

  // Single chunk: direct translate
  if (chunks.length === 1) {
    return translateText(trimmed, sourceLang, targetLang);
  }

  // Multiple chunks: translate each, then combine
  try {
    const translatedParts: string[] = [];
    for (const chunk of chunks) {
      const result = await translateText(chunk, sourceLang, targetLang);
      translatedParts.push(result.translatedText || chunk);
    }

    return {
      originalText: text,
      translatedText: translatedParts.join(' '),
      sourceLang,
      targetLang,
      status: 'translated',
      provider: 'libretranslate',
    };
  } catch (err) {
    console.error('[Translation] Long text translation failed:', err);
    return {
      originalText: text,
      translatedText: text,
      sourceLang,
      targetLang,
      status: 'failed',
      provider: 'fallback',
    };
  }
}
