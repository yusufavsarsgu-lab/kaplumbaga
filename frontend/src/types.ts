export type Language = 'tr' | 'th';
export type MessageType = 'text' | 'image' | 'audio';
export type TranslationStatus = 'translated' | 'fallback' | 'failed';
export type TranslationProvider = 'local' | 'mymemory' | 'libretranslate' | 'fallback';
export type DeliveryStatus = 'sent' | 'delivered' | 'read';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  language: Language;
  avatar: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  translatedText: string;
  originalText: string;
  from: string;
  to: string;
  timestamp: string;
  type: MessageType;
  sourceLang: Language;
  targetLang: Language;
  status: TranslationStatus;
  provider?: TranslationProvider;
  deliveryStatus?: DeliveryStatus;
  isDeleted?: boolean;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: AppUser;
  token?: string;
}
