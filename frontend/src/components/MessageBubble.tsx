import React, { useState } from 'react';
import { Check, CheckCheck, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';
import type { ChatMessage } from '../types';

interface Props {
  message: ChatMessage;
  isMe: boolean;
  onImageClick?: (src: string) => void;
  onDelete?: (messageId: string) => void;
}

const MessageBubble: React.FC<Props> = ({ message, isMe, onImageClick, onDelete }) => {
  const [showActions, setShowActions] = useState(false);
  const showOriginal = useSettingsStore((state) => state.showOriginal);
  const showTranslation = useSettingsStore((state) => state.showTranslation);
  const { language, t } = useI18n();
  const time = new Date(message.timestamp).toLocaleTimeString(language === 'th' ? 'th-TH' : 'tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const safeOriginal = message.originalText || message.translatedText || message.text || '';
  const safeTranslated = message.translatedText || message.originalText || message.text || '';
  const primaryText = isMe ? safeOriginal : safeTranslated;
  const secondaryText = isMe ? safeTranslated : safeOriginal;
  const secondaryLabel = isMe ? t('translation') : t('original');
  const canShowSecondary = isMe ? showTranslation : showOriginal;
  const showSecondary =
    canShowSecondary &&
    message.type !== 'image' &&
    Boolean(secondaryText) &&
    secondaryText.trim().toLowerCase() !== primaryText.trim().toLowerCase();

  if (message.isDeleted) {
    return (
      <div className={`mb-3 flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[86%] break-words rounded-2xl px-4 py-2 sm:max-w-[72%] ${isMe ? 'rounded-tr-sm bg-turtle-200' : 'rounded-tl-sm bg-white'}`}>
          <p className="text-xs italic text-gray-400">{t('messageDeleted')}</p>
          <span className={`mt-1 block text-[10px] ${isMe ? 'text-green-50' : 'text-gray-400'}`}>{time}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-3 flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[86%] break-words sm:max-w-[72%] ${isMe ? 'bubble-sent' : 'bubble-received'}`}
        onContextMenu={(e) => { e.preventDefault(); if (isMe) setShowActions(true); }}
      >
        {message.type === 'image' ? (
          <img
            src={message.originalText}
            alt={t('imageAltSent')}
            className="max-h-72 w-full cursor-pointer rounded-lg object-cover"
            loading="lazy"
            onClick={() => onImageClick?.(message.originalText)}
          />
        ) : (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{primaryText}</p>
        )}

        {showSecondary && (
          <p className={`mt-2 text-xs leading-relaxed opacity-80 ${isMe ? 'text-green-50' : 'text-gray-500'}`}>
            <span className="font-semibold">{secondaryLabel}: </span>
            {secondaryText}
          </p>
        )}

        {message.status === 'fallback' && message.type !== 'image' && (
          <span className={`mt-1 block text-[10px] ${isMe ? 'text-green-50/70' : 'text-gray-400'}`}>
            {t('translationNotFound')}
          </span>
        )}

        {message.status === 'failed' && message.type !== 'image' && (
          <span className={`mt-1 block text-[10px] ${isMe ? 'text-green-50/70' : 'text-gray-400'}`}>
            {t('translationFailed')}
          </span>
        )}

        <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isMe ? 'text-green-50' : 'text-gray-400'}`}>
          {time}
          {message.provider && message.provider !== 'fallback' && (
            <span className="rounded bg-black/10 px-1 py-px text-[9px] uppercase">
              {message.provider}
            </span>
          )}
          {isMe && (
            message.deliveryStatus === 'read'
              ? <CheckCheck className="h-3.5 w-3.5 text-blue-300" />
              : message.deliveryStatus === 'delivered'
                ? <CheckCheck className="h-3.5 w-3.5" />
                : <Check className="h-3.5 w-3.5" />
          )}
        </span>

        {showActions && (
          <div className="absolute -top-8 right-0 z-10 flex items-center gap-1 rounded-lg bg-white p-1 shadow-lg">
            <button
              type="button"
              onClick={() => { onDelete?.(message.id); setShowActions(false); }}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" /> Sil
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
