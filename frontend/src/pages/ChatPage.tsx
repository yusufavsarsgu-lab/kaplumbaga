import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { connectSocket, disconnectSocket, socket } from '../services/socket';
import UserHeader from '../components/UserHeader';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import EmojiPicker from '../components/EmojiPicker';
import QuickMessages from '../components/QuickMessages';
import ImageUploadButton from '../components/ImageUploadButton';
import type { AppUser, ChatMessage } from '../types';

const ChatPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const otherUser = useAuthStore((state) => state.otherUser);
  const logout = useAuthStore((state) => state.logout);
  const typingIndicatorEnabled = useSettingsStore((state) => state.typingIndicatorEnabled);
  const navigate = useNavigate();
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [appError, setAppError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const isConversationMessage = useCallback(
    (message: ChatMessage) => {
      if (!user || !otherUser) return false;
      return (
        (message.from === user.id && message.to === otherUser.id) ||
        (message.from === otherUser.id && message.to === user.id)
      );
    },
    [otherUser, user]
  );

  useEffect(() => {
    if (!user || !otherUser) return;

    const onMessage = (message: ChatMessage) => {
      if (!isConversationMessage(message)) return;
      setMessages((previous) => {
        if (previous.some((item) => item.id === message.id)) return previous;
        return [...previous, message];
      });
    };

    const onHistory = (history: ChatMessage[]) => {
      setMessages(history.filter(isConversationMessage));
    };

    const onTyping = (data: { from: string; to: string }) => {
      if (!typingIndicatorEnabled || data.from !== otherUser.id || data.to !== user.id) return;
      setTyping(true);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => setTyping(false), 1500);
    };

    const onPresence = (onlineUsers: AppUser[]) => {
      setOtherOnline(onlineUsers.some((onlineUser) => onlineUser.id === otherUser.id));
    };

    const onUserOnline = (onlineUser: AppUser) => {
      if (onlineUser.id === otherUser.id) setOtherOnline(true);
    };

    const onUserOffline = (offlineUser: { id: string }) => {
      if (offlineUser.id === otherUser.id) setOtherOnline(false);
    };

    const onAppError = () => {
      setAppError(t('errorOccurred'));
    };

    socket.on('receive_message', onMessage);
    socket.on('chat_history', onHistory);
    socket.on('typing', onTyping);
    socket.on('presence_state', onPresence);
    socket.on('user_online', onUserOnline);
    socket.on('user_offline', onUserOffline);
    socket.on('app_error', onAppError);

    connectSocket();
    socket.emit('register', user);

    return () => {
      socket.off('receive_message', onMessage);
      socket.off('chat_history', onHistory);
      socket.off('typing', onTyping);
      socket.off('presence_state', onPresence);
      socket.off('user_online', onUserOnline);
      socket.off('user_offline', onUserOffline);
      socket.off('app_error', onAppError);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isConversationMessage, otherUser, t, typingIndicatorEnabled, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  if (!user || !otherUser) {
    return <Navigate to="/" replace />;
  }

  const sendMessage = (text: string, type: 'text' | 'image' = 'text') => {
    const value = text.trim();
    if (!value) return;

    socket.emit('send_message', {
      text: value,
      from: user.id,
      to: otherUser.id,
      type,
    });
  };

  const handleTyping = () => {
    socket.emit('typing', { from: user.id, to: otherUser.id });
  };

  const appendToDraft = (text: string) => {
    setDraft((current) => (current ? `${current} ${text}` : text));
    handleTyping();
  };

  const sendPendingImage = () => {
    if (!pendingImage) return;
    sendMessage(pendingImage, 'image');
    setPendingImage(null);
  };

  const handleLogout = () => {
    disconnectSocket();
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-cream-50">
      <UserHeader
        name={otherUser.displayName}
        lang={otherUser.language}
        selfName={user.displayName}
        selfLang={user.language}
        online={otherOnline}
        onVideoCall={() => navigate('/video')}
        onSettings={() => navigate('/settings')}
        onLogout={handleLogout}
      />

      {appError && (
        <button
          type="button"
          onClick={() => setAppError('')}
          className="border-b border-red-100 bg-red-50 px-4 py-2 text-left text-sm text-red-700"
        >
          {appError}
        </button>
      )}

      <main className="kaplumbaga-chat-bg flex-1 overflow-y-auto px-3 py-4 sm:px-5 scrollbar-thin">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
          {messages.length === 0 && (
            <div className="m-auto max-w-sm rounded-lg border border-turtle-100 bg-white/90 px-5 py-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-turtle-800">{t('noMessages')}</p>
              <p className="mt-1 text-sm text-gray-500">{t('sendFirstMessage')}</p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} isMe={message.from === user.id} />
          ))}

          {typing && (
            <div className="mb-3 flex justify-start" aria-label={t('typing')}>
              <div className="rounded-lg rounded-tl-sm border border-gray-100 bg-white px-4 py-2 shadow-sm">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.3s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <QuickMessages lang={user.language} onSelect={appendToDraft} />

      <footer className="safe-bottom border-t border-gray-100 bg-white px-2 py-2 sm:px-4">
        <div className="mx-auto max-w-3xl">
          {pendingImage && (
            <div className="mb-2 flex items-center gap-3 rounded-lg border border-turtle-100 bg-turtle-50 p-2">
              <img src={pendingImage} alt={t('imageAltPreview')} className="h-14 w-14 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-turtle-900">{t('imageReady')}</p>
                <p className="truncate text-xs text-turtle-700">{t('imagePreview')}</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="rounded-full p-2 text-gray-500 transition hover:bg-white"
                title={t('remove')}
                aria-label={t('remove')}
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={sendPendingImage}
                className="rounded-full bg-turtle-700 p-2 text-white transition hover:bg-turtle-800"
                title={t('send')}
                aria-label={t('send')}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-1 sm:gap-2">
            <EmojiPicker onSelect={appendToDraft} />
            <ImageUploadButton onImageSelect={setPendingImage} onError={setAppError} />
            <ChatInput value={draft} onChange={setDraft} onSend={sendMessage} onTyping={handleTyping} />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;
