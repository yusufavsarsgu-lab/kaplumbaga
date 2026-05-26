import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';
import type { ChatMessage } from '../types';

interface Props {
  message: ChatMessage;
  isMe: boolean;
}

const MessageBubble: React.FC<Props> = ({ message, isMe }) => {
  const showOriginal = useSettingsStore((state) => state.showOriginal);
  const showTranslation = useSettingsStore((state) => state.showTranslation);
  const { language, t } = useI18n();
  const time = new Date(message.timestamp).toLocaleTimeString(language === 'th' ? 'th-TH' : 'tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const primaryText = isMe ? message.originalText : message.translatedText;
  const secondaryText = isMe ? message.translatedText : message.originalText;
  const secondaryLabel = isMe ? t('translation') : t('original');
  const canShowSecondary = isMe ? showTranslation : showOriginal;
  const showSecondary =
    canShowSecondary &&
    message.type !== 'image' &&
    Boolean(secondaryText) &&
    secondaryText.trim().toLowerCase() !== primaryText.trim().toLowerCase();

  return (
    <div className={`mb-3 flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[86%] break-words sm:max-w-[72%] ${isMe ? 'bubble-sent' : 'bubble-received'}`}>
        {message.type === 'image' ? (
          <img
            src={message.originalText}
            alt={t('imageAltSent')}
            className="max-h-72 w-full rounded-lg object-cover"
            loading="lazy"
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

        <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isMe ? 'text-green-50' : 'text-gray-400'}`}>
          {time}
          {isMe && (
            message.deliveryStatus === 'read'
              ? <CheckCheck className="h-3.5 w-3.5 text-blue-300" />
              : message.deliveryStatus === 'delivered'
                ? <CheckCheck className="h-3.5 w-3.5" />
                : <Check className="h-3.5 w-3.5" />
          )}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;
