export type Lang = 'tr' | 'th';
export type TranslationStatus = 'translated' | 'fallback';

export interface TranslationOutcome {
  originalText: string;
  translatedText: string;
  sourceLang: Lang;
  targetLang: Lang;
  status: TranslationStatus;
}

export interface Translator {
  translate(text: string, sourceLang: Lang, targetLang: Lang): Promise<TranslationOutcome>;
}

interface DictionaryEntry {
  tr: string;
  th: string;
  aliases?: string[];
}

const dictionary: DictionaryEntry[] = [
  { tr: 'Seni seviyorum', th: 'ฉันรักคุณ', aliases: ['love you', 'ฉันรักเธอ'] },
  { tr: 'Seni özledim', th: 'ฉันคิดถึงคุณ', aliases: ['miss you', 'ฉันคิดถึงเธอ'] },
  { tr: 'Nasılsın?', th: 'คุณเป็นอย่างไรบ้าง?', aliases: ['สบายดีไหม?'] },
  { tr: 'Görüntülü konuşalım mı?', th: 'เราวิดีโอคอลกันไหม?', aliases: ['วิดีโอคอลกันไหม?'] },
  { tr: 'Birazdan yazacağım', th: 'เดี๋ยวฉันจะพิมพ์หา' },
  { tr: 'Tatlı kaplumbağam', th: 'เต่าน้อยที่รักของฉัน' },
  { tr: 'Günaydın', th: 'อรุณสวัสดิ์' },
  { tr: 'Günaydın aşkım', th: 'อรุณสวัสดิ์ที่รัก' },
  { tr: 'İyi geceler', th: 'ราตรีสวัสดิ์' },
  { tr: 'İyi geceler aşkım', th: 'ราตรีสวัสดิ์ที่รัก' },
  { tr: 'Yemek yedin mi?', th: 'กินข้าวหรือยัง?' },
  { tr: 'Ben seni çok seviyorum', th: 'ฉันรักคุณมากๆ' },
  { tr: 'Ne yapıyorsun?', th: 'ทำอะไรอยู่?' },
  { tr: 'Beni özledin mi?', th: 'คิดถึงฉันไหม?' },
  { tr: 'Bugün nasılsın aşkım?', th: 'วันนี้เป็นอย่างไรบ้างที่รัก?' },
  { tr: 'Seni görmek istiyorum', th: 'ฉันอยากเจอคุณ', aliases: ['ฉันอยากเจอเธอ'] },
  { tr: 'Biraz konuşalım mı?', th: 'คุยกันสักหน่อยไหม?' },
  { tr: 'Kalbim seninle', th: 'หัวใจฉันอยู่กับคุณ' },
  { tr: 'Merhaba', th: 'สวัสดี', aliases: ['Selam'] },
  { tr: 'Teşekkür ederim', th: 'ขอบคุณมาก', aliases: ['Teşekkürler'] },
  { tr: 'Tamam', th: 'ตกลง', aliases: ['Peki'] },
  { tr: 'Görüşürüz', th: 'แล้วเจอกัน' },
];

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
      };
    }

    return {
      originalText: text,
      translatedText: targetLang === 'tr' ? entry.tr : entry.th,
      sourceLang,
      targetLang,
      status: 'translated',
    };
  }
}

class OpenAiTranslationService implements Translator {
  private readonly fallback = new LocalTranslationService(dictionary);

  async translate(text: string, sourceLang: Lang, targetLang: Lang): Promise<TranslationOutcome> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey || sourceLang === targetLang) {
      return this.fallback.translate(text, sourceLang, targetLang);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_TRANSLATION_MODEL || 'gpt-4o-mini',
          temperature: 0,
          messages: [
            {
              role: 'system',
              content:
                'Translate the user message only. Return only the translated text, without explanations or quotes.',
            },
            {
              role: 'user',
              content: `Translate from ${sourceLang} to ${targetLang}: ${text}`,
            },
          ],
        }),
      });

      if (!response.ok) return this.fallback.translate(text, sourceLang, targetLang);

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const translatedText = data.choices?.[0]?.message?.content?.trim();

      if (!translatedText) return this.fallback.translate(text, sourceLang, targetLang);

      return {
        originalText: text,
        translatedText,
        sourceLang,
        targetLang,
        status: 'translated',
      };
    } catch {
      return this.fallback.translate(text, sourceLang, targetLang);
    }
  }
}

class GoogleTranslationService implements Translator {
  private readonly fallback = new LocalTranslationService(dictionary);

  async translate(text: string, sourceLang: Lang, targetLang: Lang): Promise<TranslationOutcome> {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
    if (!apiKey || sourceLang === targetLang) {
      return this.fallback.translate(text, sourceLang, targetLang);
    }

    try {
      const url = new URL('https://translation.googleapis.com/language/translate/v2');
      url.searchParams.set('key', apiKey);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text',
        }),
      });

      if (!response.ok) return this.fallback.translate(text, sourceLang, targetLang);

      const data = (await response.json()) as {
        data?: { translations?: Array<{ translatedText?: string }> };
      };
      const translatedText = decodeHtmlEntities(data.data?.translations?.[0]?.translatedText?.trim() || '');

      if (!translatedText) return this.fallback.translate(text, sourceLang, targetLang);

      return {
        originalText: text,
        translatedText,
        sourceLang,
        targetLang,
        status: 'translated',
      };
    } catch {
      return this.fallback.translate(text, sourceLang, targetLang);
    }
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function createTranslationService(): Translator {
  const provider = process.env.TRANSLATION_PROVIDER?.trim().toLowerCase();

  if (provider === 'openai') return new OpenAiTranslationService();
  if (provider === 'google') return new GoogleTranslationService();
  return new LocalTranslationService(dictionary);
}

export const translationService: Translator = createTranslationService();

export function translateText(text: string, sourceLang: Lang, targetLang: Lang): Promise<TranslationOutcome> {
  return translationService.translate(text, sourceLang, targetLang);
}

export function autoTranslate(text: string, fromLang: Lang): Promise<TranslationOutcome> {
  const targetLang: Lang = fromLang === 'tr' ? 'th' : 'tr';
  return translateText(text, fromLang, targetLang);
}
