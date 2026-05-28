import React from 'react';
import { LogOut, Settings, Video, Phone, Search } from 'lucide-react';
import { useI18n } from '../i18n';
import TurtleLogo from './TurtleLogo';
import LanguageBadge from './LanguageBadge';
import type { Language } from '../types';

interface Props {
  name: string;
  lang: Language;
  selfName: string;
  selfLang: Language;
  online?: boolean;
  lastSeen?: string | null;
  onVideoCall?: () => void;
  onVoiceCall?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
  onSearch?: () => void;
}

function formatLastSeen(iso: string | null | undefined, lang: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return lang === 'th' ? 'เมื่อสักครู่' : 'Az önce';
  if (diffMins < 60) return lang === 'th' ? `${diffMins} นาทีที่แล้ว` : `${diffMins} dk önce`;
  if (diffHours < 24) return lang === 'th' ? `${diffHours} ชั่วโมงที่แล้ว` : `${diffHours} sa önce`;
  return lang === 'th' ? `${diffDays} วันที่แล้ว` : `${diffDays} gün önce`;
}

const UserHeader: React.FC<Props> = ({
  name,
  lang,
  selfName,
  selfLang,
  online,
  lastSeen,
  onVideoCall,
  onVoiceCall,
  onSettings,
  onLogout,
  onSearch,
}) => {
  const { t } = useI18n();

  return (
    <header className="flex items-center justify-between gap-3 bg-turtle-800 px-3 py-3 text-white shadow-sm sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <TurtleLogo size={40} className="flex-shrink-0" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-sm font-semibold leading-tight sm:text-base">{name}</h1>
            <LanguageBadge lang={lang} className="border-white/20 bg-white/10 text-white" />
            <span
              className={`h-2 w-2 flex-shrink-0 rounded-full ${online ? 'bg-green-300' : 'bg-gray-400'}`}
              title={online ? t('online') : t('offline')}
            />
          </div>
          {!online && lastSeen && (
            <div className="text-[10px] text-gray-300">
              {formatLastSeen(lastSeen, lang)}
            </div>
          )}
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-cream-100">
            <span className="truncate">
              {t('me')}: {selfName}
            </span>
            <LanguageBadge lang={selfLang} className="border-white/20 bg-white/10 text-white" />
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        {onVoiceCall && (
          <button
            type="button"
            onClick={onVoiceCall}
            className="rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
            title={t('voiceCall')}
            aria-label={t('voiceCall')}
          >
            <Phone className="h-5 w-5" />
          </button>
        )}
        {onVideoCall && (
          <button
            type="button"
            onClick={onVideoCall}
            className="rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
            title={t('videoCall')}
            aria-label={t('videoCall')}
          >
            <Video className="h-5 w-5" />
          </button>
        )}
        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            className="rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
            title={t('search')}
            aria-label={t('search')}
          >
            <Search className="h-5 w-5" />
          </button>
        )}
        {onSettings && (
          <button
            type="button"
            onClick={onSettings}
            className="rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
            title={t('settings')}
            aria-label={t('settings')}
          >
            <Settings className="h-5 w-5" />
          </button>
        )}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
            title={t('logout')}
            aria-label={t('logout')}
          >
            <LogOut className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
};

export default UserHeader;
