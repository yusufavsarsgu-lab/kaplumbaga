import React, { useRef } from 'react';
import { Send } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string, type?: 'text' | 'image') => void;
  onTyping?: () => void;
}

const ChatInput: React.FC<Props> = ({ value, onChange, onSend, onTyping }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    onSend(trimmedValue);
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          if (event.target.value.trim()) onTyping?.();
        }}
        placeholder={t('messagePlaceholder')}
        className="min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-turtle-500 focus:bg-white focus:ring-2 focus:ring-turtle-100"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-turtle-700 text-white transition hover:bg-turtle-800 disabled:cursor-not-allowed disabled:opacity-40"
        title={t('sendMessage')}
        aria-label={t('sendMessage')}
      >
        <Send className="h-5 w-5" />
      </button>
    </form>
  );
};

export default ChatInput;
