import React from 'react';
import { X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import VideoCallPanel from '../components/VideoCallPanel';
import { useAuthStore } from '../store/authStore';

const VideoCallPage: React.FC = () => {
  const navigate = useNavigate();
  const otherUser = useAuthStore((state) => state.otherUser);
  const user = useAuthStore((state) => state.user);
  const { t } = useI18n();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-gray-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-gray-950/95 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-turtle-600 text-sm font-bold">
            {otherUser?.avatar || '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{otherUser?.displayName || t('unknownUser')}</p>
            <p className="text-xs text-gray-400">{t('videoCallTitle')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
          title={t('backToChat')}
          aria-label={t('backToChat')}
        >
          <X className="h-5 w-5" />
          <span>{t('backToChat')}</span>
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center p-3 sm:p-6">
        <VideoCallPanel onEnd={() => navigate('/chat')} />
      </div>

      <footer className="border-t border-white/10 bg-gray-950 px-4 py-3 text-center text-xs text-gray-500">
        {t('videoDemoNote')}
      </footer>
    </main>
  );
};

export default VideoCallPage;
