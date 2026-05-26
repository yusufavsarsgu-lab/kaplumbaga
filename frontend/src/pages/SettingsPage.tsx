import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import TurtleLogo from '../components/TurtleLogo';
import LanguageBadge from '../components/LanguageBadge';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';

interface ToggleRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, enabled, onToggle }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div>
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="mt-0.5 text-xs leading-5 text-gray-500">{description}</p>
    </div>
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-7 w-12 flex-shrink-0 rounded-full transition ${
        enabled ? 'bg-turtle-700' : 'bg-gray-300'
      }`}
      aria-label={label}
      aria-pressed={enabled}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
          enabled ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  </div>
);

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const otherUser = useAuthStore((state) => state.otherUser);
  const theme = useSettingsStore((state) => state.theme);
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const messageSoundEnabled = useSettingsStore((state) => state.messageSoundEnabled);
  const typingIndicatorEnabled = useSettingsStore((state) => state.typingIndicatorEnabled);
  const showOriginal = useSettingsStore((state) => state.showOriginal);
  const showTranslation = useSettingsStore((state) => state.showTranslation);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const toggleSound = useSettingsStore((state) => state.toggleSound);
  const toggleMessageSound = useSettingsStore((state) => state.toggleMessageSound);
  const toggleTypingIndicator = useSettingsStore((state) => state.toggleTypingIndicator);
  const toggleShowOriginal = useSettingsStore((state) => state.toggleShowOriginal);
  const toggleShowTranslation = useSettingsStore((state) => state.toggleShowTranslation);
  const resetSettings = useSettingsStore((state) => state.reset);
  const [savedMessage, setSavedMessage] = useState('');
  const { t } = useI18n();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const handleSave = () => {
    setSavedMessage(t('saved'));
    window.setTimeout(() => setSavedMessage(''), 1800);
  };

  const handleReset = () => {
    resetSettings();
    setSavedMessage(t('saved'));
    window.setTimeout(() => setSavedMessage(''), 1800);
  };

  return (
    <main className="min-h-screen bg-cream-50">
      <header className="flex items-center gap-3 bg-turtle-800 px-4 py-4 text-white shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="rounded-full p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
          title={t('backToChat')}
          aria-label={t('backToChat')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">{t('settings')}</h1>
      </header>

      <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">
        <section className="rounded-lg border border-turtle-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <TurtleLogo size={58} />
            <div>
              <h2 className="text-xl font-bold text-turtle-900">{t('appName')}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {t('version')} 1.0.0 MVP
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">{t('account')}</h2>
          <div className="divide-y divide-gray-100 text-sm">
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-500">{t('username')}</span>
              <span className="font-medium">{user.username}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-500">{t('language')}</span>
              <LanguageBadge lang={user.language} />
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-500">{t('userId')}</span>
              <span className="font-mono text-xs text-gray-500">{user.id}</span>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">{t('chatPerson')}</h2>
          <div className="divide-y divide-gray-100 text-sm">
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-500">{t('username')}</span>
              <span className="font-medium">{otherUser?.username || '-'}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-500">{t('language')}</span>
              {otherUser ? <LanguageBadge lang={otherUser.language} /> : <span className="text-gray-400">-</span>}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">{t('chatSettings')}</h2>
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-gray-900">{t('theme')}</p>
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-1">
              {(['light', 'turtle', 'dark'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTheme(option)}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                    theme === option ? 'bg-white text-turtle-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {option === 'light' ? t('light') : option === 'turtle' ? t('turtleGreen') : t('dark')}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('language')}</p>
                <p className="mt-0.5 text-xs leading-5 text-gray-500">{t('languageAuto')}</p>
              </div>
              <LanguageBadge lang={user.language} />
            </div>
          </div>

          <div className="mt-3 divide-y divide-gray-100">
            <ToggleRow
              label={t('notificationSound')}
              description={t('soundDescription')}
              enabled={soundEnabled}
              onToggle={toggleSound}
            />
            <ToggleRow
              label={t('messageSound')}
              description={t('messageSoundDescription')}
              enabled={messageSoundEnabled}
              onToggle={toggleMessageSound}
            />
            <ToggleRow
              label={t('typingIndicator')}
              description={t('typingDescription')}
              enabled={typingIndicatorEnabled}
              onToggle={toggleTypingIndicator}
            />
            <ToggleRow
              label={t('showOriginal')}
              description={t('showOriginalDescription')}
              enabled={showOriginal}
              onToggle={toggleShowOriginal}
            />
            <ToggleRow
              label={t('showTranslation')}
              description={t('showTranslationDescription')}
              enabled={showTranslation}
              onToggle={toggleShowTranslation}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-turtle-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-turtle-800"
            >
              {t('save')}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              {t('reset')}
            </button>
            {savedMessage && <span className="text-sm font-medium text-turtle-700">{savedMessage}</span>}
          </div>

          <p className="mt-3 text-xs text-gray-500">{t('localStorageNote')}</p>
        </section>

        <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-900">{t('aboutApp')}</h2>
          <p className="text-sm leading-6 text-gray-600">{t('appDescription')}</p>
          <p className="mt-3 text-sm leading-6 text-gray-600">{t('settingsNotes')}</p>
        </section>
      </div>
    </main>
  );
};

export default SettingsPage;
