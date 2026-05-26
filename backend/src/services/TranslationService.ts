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
  translate(text: string, sourceLang: Lang, targetLang: Lang): TranslationOutcome;
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

function normalize(text: string): string {
  return text
    .trim()
    .normalize('NFC')
    .toLocaleLowerCase('tr-TR')
    .replace(/[.!?。！？]+$/u, '')
    .replace(/\s+/g, ' ');
}

class DemoTranslationService implements Translator {
  private readonly lookup = new Map<string, DictionaryEntry>();

  constructor(entries: DictionaryEntry[]) {
    for (const entry of entries) {
      this.lookup.set(normalize(entry.tr), entry);
      this.lookup.set(normalize(entry.th), entry);

      for (const alias of entry.aliases || []) {
        this.lookup.set(normalize(alias), entry);
      }
    }
  }

  translate(text: string, sourceLang: Lang, targetLang: Lang): TranslationOutcome {
    const entry = this.lookup.get(normalize(text));

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

export const translationService: Translator = new DemoTranslationService(dictionary);

export function translateText(text: string, sourceLang: Lang, targetLang: Lang): TranslationOutcome {
  return translationService.translate(text, sourceLang, targetLang);
}

export function autoTranslate(text: string, fromLang: Lang): TranslationOutcome {
  const targetLang: Lang = fromLang === 'tr' ? 'th' : 'tr';
  return translateText(text, fromLang, targetLang);
}
