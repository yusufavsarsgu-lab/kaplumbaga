import React, { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  onSelect: (emoji: string) => void;
}

const EmojiPicker: React.FC<Props> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const { emojiCategories, t } = useI18n();
  const category = emojiCategories[activeCategory] ?? emojiCategories[0];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 hover:text-turtle-800"
        title={t('addEmoji')}
        aria-label={t('addEmoji')}
      >
        <Smile className="h-5 w-5" />
      </button>
      {open && category && (
        <div className="absolute bottom-14 left-0 z-50 w-[min(21rem,calc(100vw-1.5rem))] rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
          <div className="mb-3 flex gap-1 overflow-x-auto scrollbar-thin">
            {emojiCategories.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveCategory(index)}
                className={`flex-shrink-0 rounded-md px-2 py-1 text-xs font-medium transition ${
                  index === activeCategory ? 'bg-turtle-700 text-white' : 'bg-gray-50 text-gray-600 hover:bg-turtle-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid max-h-48 grid-cols-6 gap-1 overflow-y-auto scrollbar-thin sm:grid-cols-8">
            {category.emojis.map((emoji, index) => (
              <button
                key={`${category.id}-${emoji}-${index}`}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setOpen(false);
                }}
                className="rounded-md p-2 text-xl transition hover:bg-turtle-50"
                aria-label={`${category.label} ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;
