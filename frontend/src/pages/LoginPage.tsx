import React, { useMemo, useState } from 'react';
import { LogIn, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getT } from '../i18n';
import TurtleLogo from '../components/TurtleLogo';
import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../services/api';
import type { AppUser, Language, LoginResponse } from '../types';

const otherUserMap: Record<string, AppUser> = {
  'user-yusuf': { id: 'user-neeja', username: 'Neeja', displayName: 'Neeja', language: 'th', avatar: 'N' },
  'user-neeja': { id: 'user-yusuf', username: 'Yusuf', displayName: 'Yusuf', language: 'tr', avatar: 'Y' },
};

const demoAccounts: Array<{ username: string; language: Language; labelKey: string }> = [
  { username: 'Yusuf', language: 'tr', labelKey: 'loginAsYusuf' },
  { username: 'Neeja', language: 'th', labelKey: 'loginAsNeeja' },
];

function getLoginLanguage(username: string): Language {
  return username.trim().toLocaleLowerCase('tr-TR') === 'neeja' ? 'th' : 'tr';
}

function getErrorMessage(error: unknown, t: (key: string) => string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message);
    if (message === 'missing_credentials') return t('credentialsRequired');
    if (message === 'invalid_credentials') return t('invalidCredentials');
  }

  return t('serverUnavailable');
}

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const setOtherUser = useAuthStore((state) => state.setOtherUser);
  const activeLanguage = getLoginLanguage(username);
  const t = useMemo(() => getT(activeLanguage), [activeLanguage]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!username.trim() || !password.trim()) {
        setError(t('credentialsRequired'));
        return;
      }

      const data = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      if (!data.success || !data.user) {
        setError(t('invalidCredentials'));
        return;
      }

      setUser(data.user);
      setOtherUser(otherUserMap[data.user.id] || null);
      navigate('/chat');
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (accountName: string) => {
    setUsername(accountName);
    setPassword('123456');
    setError('');
  };

  return (
    <main className="min-h-screen bg-cream-100 px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-lg border border-turtle-100 bg-white shadow-xl shadow-turtle-900/10 md:grid-cols-[1.05fr_0.95fr]">
          <div className="flex min-h-[260px] flex-col justify-between bg-turtle-800 p-8 text-white sm:p-10">
            <div>
              <TurtleLogo size={82} className="mb-5 drop-shadow-sm" />
              <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">{t('appName')}</h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-cream-100">{t('appIntro')}</p>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 text-sm" aria-label={t('demoUsers')}>
              {demoAccounts.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => fillDemoAccount(account.username)}
                  className="rounded-lg border border-white/15 bg-white/10 px-3 py-3 text-left transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cream-100"
                  aria-label={t(account.labelKey)}
                >
                  <span className="block font-semibold">{account.username}</span>
                  <span className="mt-1 block text-xs text-cream-100">
                    {account.language === 'tr' ? t('languageTurkish') : t('languageThai')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-turtle-700">{t('loginPrivate')}</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">{t('signInToAccount')}</h2>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="username">
                  {t('username')}
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder={t('usernamePlaceholder')}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-turtle-500 focus:bg-white focus:ring-2 focus:ring-turtle-100"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="password">
                  {t('password')}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-turtle-500 focus:bg-white focus:ring-2 focus:ring-turtle-100"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-turtle-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-turtle-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" />
                {loading ? t('loginLoading') : t('login')}
              </button>
            </form>

            <p className="mt-5 text-xs leading-5 text-gray-500">{t('demoPasswordNote')}</p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
