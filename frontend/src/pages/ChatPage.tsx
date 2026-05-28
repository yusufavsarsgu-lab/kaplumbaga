import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Send, X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useCallStore } from '../store/callStore';
import { useStoryStore } from '../store/storyStore';
import { connectSocket, disconnectSocket, socket } from '../services/socket';
import UserHeader from '../components/UserHeader';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import EmojiPicker from '../components/EmojiPicker';
import ImageUploadButton from '../components/ImageUploadButton';
import FileUploadButton from '../components/FileUploadButton';
import VoiceRecorder from '../components/VoiceRecorder';
import VideoCallOverlay from '../components/VideoCallOverlay';
import StoryBar from '../components/StoryBar';
import StoryViewer from '../components/StoryViewer';
import CallHistoryModal from '../components/CallHistoryModal';
import type { AppUser, ChatMessage, DeliveryStatus } from '../types';

const ChatPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const otherUser = useAuthStore((state) => state.otherUser);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const typingIndicatorEnabled = useSettingsStore((state) => state.typingIndicatorEnabled);
  const background = useSettingsStore((state) => state.background);
  const navigate = useNavigate();
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherLastSeen, setOtherLastSeen] = useState<string | null>(null);
  const [appError, setAppError] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewingStoryId, setViewingStoryId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [callLogs, setCallLogs] = useState<Array<{ id: string; callerId: string; receiverId: string; status: string; startedAt: string; endedAt?: string | null; callType?: string }>>([]);
  const [showCallHistory, setShowCallHistory] = useState(false);
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
    if (!user || !otherUser || !token) return;

    const onMessage = (message: ChatMessage) => {
      if (!isConversationMessage(message)) return;
      setMessages((previous) => {
        if (previous.some((item) => item.id === message.id)) return previous;
        return [...previous, message];
      });
      if (message.from === otherUser.id && message.to === user.id) {
        socket.emit('mark_read', { messageIds: [message.id] });
      }
    };

    const onHistory = (history: ChatMessage[]) => {
      const filtered = history.filter(isConversationMessage);
      setMessages(filtered);
      const unread = filtered.filter((m) => m.from === otherUser.id && m.to === user.id && m.deliveryStatus !== 'read');
      if (unread.length > 0) {
        socket.emit('mark_read', { messageIds: unread.map((m) => m.id) });
      }
    };

    const onStatusUpdated = (data: { messageIds: string[]; status: DeliveryStatus }) => {
      setMessages((prev) =>
        prev.map((m) => (data.messageIds.includes(m.id) ? { ...m, deliveryStatus: data.status } : m))
      );
    };

    const onMessageDeleted = (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, isDeleted: true, text: '', originalText: '', translatedText: '' } : m
        )
      );
    };

    const onMessageReactions = (data: { messageId: string; reactions: Array<{ emoji: string; count: number; userReacted: boolean }> }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m))
      );
    };

    const onCallLogs = (logs: Array<{ id: string; callerId: string; receiverId: string; status: string; startedAt: string; endedAt?: string | null; callType?: string }>) => {
      setCallLogs(logs);
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

    const setStories = useStoryStore.getState().setStories;

    const onUserOffline = (offlineUser: { id: string; lastSeen?: string }) => {
      if (offlineUser.id === otherUser.id) {
        setOtherOnline(false);
        if (offlineUser.lastSeen) setOtherLastSeen(offlineUser.lastSeen);
      }
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
    socket.on('messages_status_updated', onStatusUpdated);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('message_reactions', onMessageReactions);
    socket.on('call_logs_update', onCallLogs);
    socket.on('stories_update', setStories);

    connectSocket(token);
    socket.emit('register');
    socket.emit('get_stories');

    return () => {
      socket.off('receive_message', onMessage);
      socket.off('chat_history', onHistory);
      socket.off('typing', onTyping);
      socket.off('presence_state', onPresence);
      socket.off('user_online', onUserOnline);
      socket.off('user_offline', onUserOffline);
      socket.off('app_error', onAppError);
      socket.off('messages_status_updated', onStatusUpdated);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('message_reactions', onMessageReactions);
      socket.off('call_logs_update', onCallLogs);
      socket.off('stories_update', setStories);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isConversationMessage, otherUser, t, token, typingIndicatorEnabled, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const setIncomingCall = useCallStore((state) => state.setIncomingCall);
  const incomingCall = useCallStore((state) => state.incomingCall);
  const startCall = useCallStore((state) => state.startCall);
  const isInCall = useCallStore((state) => state.isInCall);

  const acceptCall = () => {
    startCall();
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!otherUser) return;
    socket.emit('delete_message', { messageId, to: otherUser.id });
  };

  const rejectCall = () => {
    if (otherUser) {
      socket.emit('call_rejected', { to: otherUser.id });
    }
    setIncomingCall(null);
  };

  if (!user || !otherUser || !token) {
    return <Navigate to="/" replace />;
  }

  const sendMessage = (text: string, type: 'text' | 'image' | 'audio' | 'file' = 'text') => {
    const value = text.trim();
    if (!value) return;

    socket.emit('send_message', {
      text: value,
      to: otherUser.id,
      type,
      replyToId: replyTo?.id || undefined,
    });
    setReplyTo(null);
  };

  const handleTyping = () => {
    socket.emit('typing', { to: otherUser.id });
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
    <div className={`flex h-[100dvh] flex-col overflow-hidden ${
      background === 'default' ? 'bg-cream-50' :
      background === 'gradient-blue' ? 'bg-gradient-to-br from-blue-50 to-indigo-100' :
      background === 'gradient-green' ? 'bg-gradient-to-br from-green-50 to-emerald-100' :
      background === 'gradient-purple' ? 'bg-gradient-to-br from-purple-50 to-pink-100' :
      background === 'pattern-dots' ? 'bg-cream-50' :
      'bg-cream-50'
    }`}>
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Preview"
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white backdrop-blur transition hover:bg-white/40"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      {incomingCall && !isInCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-turtle-100 text-2xl font-bold text-turtle-800">
              {otherUser.avatar}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">{t('incomingCall')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('incomingCallFrom', { name: otherUser.displayName })}
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <button
                type="button"
                onClick={rejectCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700"
                title={t('reject')}
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={acceptCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition hover:bg-green-700"
                title={t('accept')}
              >
                <Phone className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      <VideoCallOverlay />

      {viewingStoryId && (
        <StoryViewer storyId={viewingStoryId} onClose={() => setViewingStoryId(null)} />
      )}

      <StoryBar
        onCreate={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              socket.emit('create_story', {
                mediaData: reader.result as string,
                type: 'image',
              });
            };
            reader.readAsDataURL(file);
          };
          input.click();
        }}
        onView={(id) => setViewingStoryId(id)}
      />

      <UserHeader
        name={otherUser.displayName}
        lang={otherUser.language}
        selfName={user.displayName}
        selfLang={user.language}
        online={otherOnline}
        lastSeen={otherLastSeen}
        onVideoCall={() => {
          if (isInCall) return;
          if (!otherOnline) {
            setAppError(t('userOffline'));
            return;
          }
          startCall('video');
        }}
        onVoiceCall={() => {
          if (isInCall) return;
          if (!otherOnline) {
            setAppError(t('userOffline'));
            return;
          }
          startCall('audio');
        }}
        onSettings={() => navigate('/settings')}
        onSearch={() => setIsSearching((s) => !s)}
        onCallHistory={() => { socket.emit('get_call_logs'); setShowCallHistory(true); }}
        onLogout={handleLogout}
      />

      {showCallHistory && (
        <CallHistoryModal
          logs={callLogs}
          userId={user.id}
          otherName={otherUser.displayName}
          onClose={() => setShowCallHistory(false)}
        />
      )}

      {appError && (
        <button
          type="button"
          onClick={() => setAppError('')}
          className="border-b border-red-100 bg-red-50 px-4 py-2 text-left text-sm text-red-700"
        >
          {appError}
        </button>
      )}

      {isSearching && (
        <div className="border-b border-gray-100 bg-white px-3 py-2">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchMessages')}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-turtle-500 focus:outline-none focus:ring-1 focus:ring-turtle-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => { setIsSearching(false); setSearchQuery(''); }}
              className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="kaplumbaga-chat-bg flex-1 overflow-y-auto px-3 py-4 sm:px-5 scrollbar-thin">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
          {messages.length === 0 && (
            <div className="m-auto max-w-sm rounded-lg border border-turtle-100 bg-white/90 px-5 py-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-turtle-800">{t('noMessages')}</p>
              <p className="mt-1 text-sm text-gray-500">{t('sendFirstMessage')}</p>
            </div>
          )}

          {messages
            .filter((m) => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return (
                m.text.toLowerCase().includes(q) ||
                m.originalText?.toLowerCase().includes(q) ||
                m.translatedText?.toLowerCase().includes(q)
              );
            })
            .map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isMe={message.from === user.id}
                onImageClick={setSelectedImage}
                onDelete={handleDeleteMessage}
                onReply={setReplyTo}
              />
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

          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-turtle-100 bg-turtle-50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-turtle-700">{t('replyingTo')}</p>
                <p className="truncate text-xs text-gray-600">
                  {replyTo.type === 'image' ? 'Resim' : replyTo.type === 'audio' ? 'Sesli mesaj' : replyTo.type === 'file' ? 'Dosya' : replyTo.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="rounded-full p-1 text-gray-500 hover:bg-white"
                title={t('remove')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-1 sm:gap-2">
            <EmojiPicker onSelect={appendToDraft} />
            <ImageUploadButton onImageSelect={setPendingImage} onError={setAppError} />
            <FileUploadButton onFileSelect={(file) => sendMessage(file, 'file')} onError={setAppError} />
            <VoiceRecorder onAudioRecorded={(audio) => sendMessage(audio, 'audio')} />
            <ChatInput value={draft} onChange={setDraft} onSend={sendMessage} onTyping={handleTyping} />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;
