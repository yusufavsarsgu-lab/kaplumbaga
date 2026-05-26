import React from 'react';
import { getBundle, getT } from '../i18n';
import type { Language } from '../types';

interface Props {
  lang: Language;
  onSelect: (text: string) => void;
}

const QuickMessages: React.FC<Props> = ({ lang, onSelect }) => {
  const messages = getBundle(lang).quickMessages;
  const t = getT(lang);

  return (
    <section className="border-t border-gray-100 bg-white px-3 py-2" aria-label={t('quickMessages')}>
      <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto scrollbar-thin">
        {messages.map((message) => (
          <button
            key={message.text}
            type="button"
            onClick={() => onSelect(message.text)}
            className="flex-shrink-0 whitespace-nowrap rounded-full border border-turtle-100 bg-turtle-50 px-3 py-1.5 text-xs font-medium text-turtle-800 transition hover:bg-turtle-100"
          >
            {message.label}
          </button>
        ))}
      </div>
    </section>
  );
};

export default QuickMessages;
