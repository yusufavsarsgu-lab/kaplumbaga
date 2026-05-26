import React from 'react';
import { useI18n } from '../i18n';
import type { Language } from '../types';

interface Props {
  lang: Language;
  className?: string;
}

const LanguageBadge: React.FC<Props> = ({ lang, className = '' }) => {
  const { t } = useI18n();
  const label = lang === 'tr' ? t('languageTurkish') : t('languageThai');

  return (
    <span
      className={`inline-flex items-center rounded-full border border-turtle-200 bg-turtle-50 px-2 py-0.5 text-[10px] font-semibold text-turtle-800 ${className}`}
    >
      {label}
    </span>
  );
};

export default LanguageBadge;
