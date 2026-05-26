export type Language = 'tr' | 'th';
export type MessageType = 'text' | 'image';
export type TranslationStatus = 'translated' | 'fallback';

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
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: AppUser;
}
