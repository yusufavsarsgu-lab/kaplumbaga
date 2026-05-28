import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import cors from 'cors';
import authRoutes from './routes/auth';
import { prisma } from './db/prisma';
import { getBearerToken, verifyAuthToken } from './services/AuthService';
import { translateText, translateLongText, type TranslationProvider } from './services/TranslationService';
import { saveFcmToken, queueNotification, getPendingNotifications } from './services/PushNotificationService';

const app = express();
const httpServer = createServer(app);

type Language = 'tr' | 'th';
type MessageType = 'text' | 'image' | 'audio' | 'file';
type TranslationStatus = 'translated' | 'fallback';
type DeliveryStatus = 'sent' | 'delivered' | 'read';

interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  language: Language;
  avatar: string;
}

interface OnlineUser extends PublicUser {
  socketId: string;
}

interface ChatMessage {
  id: string;
  text: string;
  translatedText: string;
  originalText: string;
  from: string;
  to: string;
  timestamp: string;
  type: MessageType;
  sourceLang: Language;
  targetLang: Language;
  status: TranslationStatus;
  provider: TranslationProvider;
  deliveryStatus: DeliveryStatus;
  isDeleted: boolean;
  replyToId?: string | null;
  replyTo?: { id: string; text: string; type: MessageType } | null;
  reactions?: Array<{ emoji: string; count: number; userReacted: boolean }>;
}

interface ClientToServerEvents {
  register: (user?: PublicUser) => void;
  send_message: (payload: { text: string; from?: string; to: string; type?: MessageType; replyToId?: string }) => void;
  mark_read: (data: { messageIds: string[]; readBy?: string }) => void;
  delete_message: (data: { messageId: string; to: string }) => void;
  typing: (data: { from?: string; to: string }) => void;
  call_offer: (data: { from?: string; to: string; offer: unknown; callType?: 'video' | 'audio' }) => void;
  call_answer: (data: { to: string; answer: unknown }) => void;
  call_rejected: (data: { to: string }) => void;
  ice_candidate: (data: { to: string; candidate: unknown }) => void;
  end_call: (data: { to: string }) => void;
  register_fcm_token: (data: { token: string }) => void;
  create_story: (data: { mediaData: string; type?: string; caption?: string }) => void;
  get_stories: () => void;
  view_story: (data: { storyId: string }) => void;
  add_reaction: (data: { messageId: string; emoji: string }) => void;
  remove_reaction: (data: { messageId: string; emoji: string }) => void;
  get_call_logs: () => void;
}

interface ServerToClientEvents {
  user_online: (user: PublicUser) => void;
  user_offline: (user: { id: string; lastSeen?: string }) => void;
  presence_state: (users: PublicUser[]) => void;
  chat_history: (messages: ChatMessage[]) => void;
  receive_message: (message: ChatMessage) => void;
  typing: (data: { from: string; to: string }) => void;
  messages_status_updated: (data: { messageIds: string[]; status: DeliveryStatus }) => void;
  message_deleted: (data: { messageId: string }) => void;
  incoming_call: (data: { from: string; offer: unknown; callType?: 'video' | 'audio' }) => void;
  call_accepted: (data: { answer: unknown }) => void;
  call_rejected: () => void;
  ice_candidate: (data: { candidate: unknown }) => void;
  call_ended: () => void;
  app_error: (error: { message: string }) => void;
  stories_update: (stories: Array<{ id: string; userId: string; mediaData: string; type: string; caption?: string | null; createdAt: string; viewed: boolean }>) => void;
  show_notification: (data: { title: string; body: string; data?: Record<string, string> }) => void;
  message_reactions: (data: { messageId: string; reactions: Array<{ emoji: string; count: number; userReacted: boolean }> }) => void;
  call_logs_update: (logs: Array<{ id: string; callerId: string; receiverId: string; status: string; startedAt: string; endedAt?: string | null; callType?: string }>) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  userId?: string;
}

type KaplumbagaSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const localHostName = 'local' + 'host';
const loopbackHostName = ['127', '0', '0', '1'].join('.');
const defaultClientUrls = [`http://${localHostName}:5173`, `http://${loopbackHostName}:5173`];
let allowedOrigins = (process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : defaultClientUrls)
  .map((origin) => origin.trim())
  .filter(Boolean);

// Mobil APK (Capacitor WebView) origin desteği
const mobileOrigins = ['https://localhost', 'http://localhost', 'capacitor://localhost', 'ionic://localhost'];
for (const mo of mobileOrigins) {
  if (!allowedOrigins.includes(mo)) allowedOrigins.push(mo);
}

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET?.trim()) {
  throw new Error('JWT_SECRET is required in production.');
}

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
};

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 10_000_000,
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

app.get('/health', async (_req, res) => {
  try {
    const test = await translateText('hello', 'tr', 'th');
    res.json({ status: 'ok', service: 'kaplumbaga-api', translation: test });
  } catch (err) {
    res.json({ status: 'ok', service: 'kaplumbaga-api', translationError: (err as Error).message });
  }
});

app.use('/api/auth', authRoutes);

const onlineUsers = new Map<string, OnlineUser>();

function toPublicUser(user: {
  id: string;
  username: string;
  displayName: string;
  language: string;
  avatarUrl: string | null;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    language: toLanguage(user.language),
    avatar: user.avatarUrl || user.displayName.slice(0, 1).toUpperCase(),
  };
}

function toLanguage(value: string): Language {
  return value === 'th' ? 'th' : 'tr';
}

function toMessageType(value: string): MessageType {
  return value === 'image' ? 'image' : 'text';
}

function toTranslationStatus(value: string): TranslationStatus {
  return value === 'translated' ? 'translated' : 'fallback';
}

function toDeliveryStatus(value: string): DeliveryStatus {
  if (value === 'read') return 'read';
  if (value === 'delivered') return 'delivered';
  return 'sent';
}

function toChatMessage(message: {
  id: string;
  senderId: string;
  receiverId: string;
  type: string;
  originalText: string | null;
  translatedText: string | null;
  sourceLang: string;
  targetLang: string;
  translationStatus: string;
  translationProvider?: string | null;
  imageData: string | null;
  imageUrl: string | null;
  deliveryStatus: string;
  isDeleted?: boolean;
  replyToId?: string | null;
  replyTo?: { id: string; originalText: string | null; translatedText: string | null; type: string; imageData: string | null; imageUrl: string | null } | null;
  createdAt: Date;
}): ChatMessage {
  const type = toMessageType(message.type);
  const originalText = type === 'image' || type === 'audio' || type === 'file' ? message.imageData || message.imageUrl || '' : message.originalText || '';
  const translatedText = type === 'image' || type === 'audio' || type === 'file' ? originalText : message.translatedText || originalText;
  const provider = (message.translationProvider || 'fallback') as TranslationProvider;

  const replyToText = message.replyTo
    ? (toMessageType(message.replyTo.type) === 'image' || toMessageType(message.replyTo.type) === 'audio' || toMessageType(message.replyTo.type) === 'file'
        ? (message.replyTo.imageData || message.replyTo.imageUrl || '')
        : (message.replyTo.translatedText || message.replyTo.originalText || ''))
    : '';

  return {
    id: message.id,
    text: translatedText,
    translatedText,
    originalText,
    from: message.senderId,
    to: message.receiverId,
    timestamp: message.createdAt.toISOString(),
    type,
    sourceLang: toLanguage(message.sourceLang),
    targetLang: toLanguage(message.targetLang),
    status: toTranslationStatus(message.translationStatus),
    provider,
    deliveryStatus: toDeliveryStatus(message.deliveryStatus),
    isDeleted: message.isDeleted || false,
    replyToId: message.replyToId || null,
    replyTo: message.replyTo
      ? { id: message.replyTo.id, text: replyToText, type: toMessageType(message.replyTo.type) }
      : null,
  };
}

function aggregateReactions(
  reactions: Array<{ emoji: string; userId: string }>,
  currentUserId: string
): Array<{ emoji: string; count: number; userReacted: boolean }> {
  const map = new Map<string, { count: number; userReacted: boolean }>();
  for (const r of reactions) {
    const existing = map.get(r.emoji) || { count: 0, userReacted: false };
    existing.count++;
    if (r.userId === currentUserId) existing.userReacted = true;
    map.set(r.emoji, existing);
  }
  return Array.from(map.entries()).map(([emoji, data]) => ({ emoji, count: data.count, userReacted: data.userReacted }));
}

async function getPublicUser(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}

function getOnlinePublicUsers(): PublicUser[] {
  return Array.from(onlineUsers.values()).map(({ socketId: _socketId, ...user }) => user);
}

async function getConversationMessages(userId: string): Promise<ChatMessage[]> {
  const messages = await prisma.message.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  return messages.map(toChatMessage);
}

function emitToUser<K extends keyof ServerToClientEvents>(
  userId: string,
  event: K,
  ...payload: Parameters<ServerToClientEvents[K]>
) {
  const onlineUser = onlineUsers.get(userId);
  if (!onlineUser) return;
  io.to(onlineUser.socketId).emit(event, ...payload);
}

async function markPendingMessagesDelivered(userId: string) {
  const pending = await prisma.message.findMany({
    where: { receiverId: userId, deliveryStatus: 'sent' },
    select: { id: true, senderId: true },
  });

  if (pending.length === 0) return;

  const messageIds = pending.map((message) => message.id);
  await prisma.message.updateMany({
    where: { id: { in: messageIds } },
    data: { deliveryStatus: 'delivered' },
  });

  const senderIds = new Set(pending.map((message) => message.senderId));
  for (const senderId of senderIds) {
    emitToUser(senderId, 'messages_status_updated', { messageIds, status: 'delivered' });
  }
}

function getSocketToken(socket: KaplumbagaSocket): string | undefined {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string') return authToken;

  const header = socket.handshake.headers.authorization;
  return getBearerToken(Array.isArray(header) ? header[0] : header);
}

io.use((socket, next) => {
  const payload = verifyAuthToken(getSocketToken(socket));

  if (!payload) {
    next(new Error('unauthorized'));
    return;
  }

  socket.data.userId = payload.userId;
  next();
});

io.on('connection', async (socket) => {
  const userId = socket.data.userId;
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  const profile = await getPublicUser(userId);
  if (!profile) {
    socket.emit('app_error', { message: 'user_not_found' });
    socket.disconnect(true);
    return;
  }

  onlineUsers.set(profile.id, { ...profile, socketId: socket.id });
  socket.broadcast.emit('user_online', profile);
  socket.emit('presence_state', getOnlinePublicUsers());
  socket.emit('chat_history', await getConversationMessages(profile.id));
  await markPendingMessagesDelivered(profile.id);

  socket.on('register', async () => {
    socket.emit('presence_state', getOnlinePublicUsers());
    socket.emit('chat_history', await getConversationMessages(profile.id));

    // Bekleyen bildirimleri gönder
    const pending = getPendingNotifications(profile.id);
    for (const n of pending) {
      socket.emit('show_notification', { title: n.title, body: n.body, data: n.data });
    }
  });

  socket.on('register_fcm_token', async (data) => {
    try {
      await saveFcmToken(profile.id, data.token);
      console.log('[Push] FCM token registered for user', profile.id);
    } catch (err) {
      console.error('[Push] FCM token registration failed:', err);
    }
  });

  socket.on('send_message', async (payload) => {
    try {
      const sender = await prisma.user.findUnique({ where: { id: profile.id } });
      const receiver = await prisma.user.findUnique({ where: { id: payload.to } });
      const type = payload.type || 'text';
      const rawText = payload.text.trim();

      if (!sender || !receiver) {
        socket.emit('app_error', { message: 'message_user_missing' });
        return;
      }

      if (!rawText) {
        socket.emit('app_error', { message: 'empty_message' });
        return;
      }

      if (type === 'image' && (!rawText.startsWith('data:image/') || rawText.length > 4_500_000)) {
        socket.emit('app_error', { message: 'invalid_image' });
        return;
      }

      if (type === 'audio' && (!rawText.startsWith('data:audio/') || rawText.length > 2_000_000)) {
        socket.emit('app_error', { message: 'invalid_audio' });
        return;
      }

      if (type === 'file' && (!rawText.startsWith('data:') || rawText.length > 5_000_000)) {
        socket.emit('app_error', { message: 'invalid_file' });
        return;
      }

      const deliveryStatus: DeliveryStatus = onlineUsers.has(receiver.id) ? 'delivered' : 'sent';
      let translation;
      if (type === 'image' || type === 'audio' || type === 'file') {
        translation = {
          originalText: rawText,
          translatedText: rawText,
          sourceLang: sender.language as Language,
          targetLang: receiver.language as Language,
          status: 'translated' as TranslationStatus,
          provider: 'local' as TranslationProvider,
        };
      } else if (rawText.length > 500) {
        translation = await translateLongText(rawText, sender.language as Language, receiver.language as Language);
      } else {
        translation = await translateText(rawText, sender.language as Language, receiver.language as Language);
      }

      const created = await prisma.message.create({
        data: {
          senderId: sender.id,
          receiverId: receiver.id,
          type,
          originalText: type === 'image' || type === 'audio' || type === 'file' ? null : translation.originalText,
          translatedText: type === 'image' || type === 'audio' || type === 'file' ? null : translation.translatedText,
          sourceLang: translation.sourceLang,
          targetLang: translation.targetLang,
          translationStatus: translation.status,
          imageData: type === 'image' || type === 'audio' || type === 'file' ? rawText : null,
          replyToId: payload.replyToId || null,
          deliveryStatus,
        },
      });

      const chatMessage = toChatMessage(created);
      chatMessage.provider = (type === 'image' || type === 'audio' || type === 'file' ? 'local' : translation.provider) as TranslationProvider;
      socket.emit('receive_message', chatMessage);
      emitToUser(receiver.id, 'receive_message', chatMessage);

      // Bildirim kuyruğa al (kullanıcı çevrimdışıysa)
      if (!onlineUsers.has(receiver.id)) {
        const pushTitle = sender.displayName;
        const pushBody = type === 'image' ? 'Resim gönderdi' : type === 'audio' ? 'Sesli mesaj gönderdi' : type === 'file' ? 'Dosya gönderdi' : (chatMessage.originalText || 'Yeni mesaj');
        queueNotification(receiver.id, pushTitle, pushBody, {
          messageId: chatMessage.id,
          senderId: sender.id,
          type,
        });
      } else {
        // Kullanıcı çevrimiçiyse socket ile bildirim gönder
        emitToUser(receiver.id, 'show_notification', {
          title: sender.displayName,
          body: type === 'image' ? 'Resim gönderdi' : type === 'audio' ? 'Sesli mesaj gönderdi' : type === 'file' ? 'Dosya gönderdi' : (chatMessage.originalText || 'Yeni mesaj'),
          data: { messageId: chatMessage.id, senderId: sender.id, type },
        });
      }
    } catch (error) {
      console.error('[socket] send_message failed', error);
      socket.emit('app_error', { message: 'message_send_failed' });
    }
  });

  socket.on('delete_message', async (data) => {
    try {
      const message = await prisma.message.findUnique({ where: { id: data.messageId } });
      if (!message || message.senderId !== profile.id) {
        socket.emit('app_error', { message: 'delete_unauthorized' });
        return;
      }
      await prisma.message.update({
        where: { id: data.messageId },
        data: { isDeleted: true, originalText: '', translatedText: '' },
      });
      socket.emit('message_deleted', { messageId: data.messageId });
      emitToUser(data.to, 'message_deleted', { messageId: data.messageId });
    } catch (error) {
      console.error('[socket] delete_message failed', error);
      socket.emit('app_error', { message: 'delete_failed' });
    }
  });

  socket.on('mark_read', async (data) => {
    const messageIds = data.messageIds.filter(Boolean);
    if (messageIds.length === 0) return;

    const readableMessages = await prisma.message.findMany({
      where: {
        id: { in: messageIds },
        receiverId: profile.id,
      },
      select: { id: true, senderId: true },
    });

    if (readableMessages.length === 0) return;

    const readableIds = readableMessages.map((message) => message.id);
    await prisma.message.updateMany({
      where: { id: { in: readableIds } },
      data: { deliveryStatus: 'read' },
    });

    socket.emit('messages_status_updated', { messageIds: readableIds, status: 'read' });
    const senderIds = new Set(readableMessages.map((message) => message.senderId));
    for (const senderId of senderIds) {
      emitToUser(senderId, 'messages_status_updated', { messageIds: readableIds, status: 'read' });
    }
  });

  socket.on('typing', (data) => {
    emitToUser(data.to, 'typing', { from: profile.id, to: data.to });
  });

  socket.on('call_offer', async (data) => {
    await prisma.callLog.create({
      data: {
        callerId: profile.id,
        receiverId: data.to,
        status: 'ringing',
      },
    });
    emitToUser(data.to, 'incoming_call', { from: profile.id, offer: data.offer, callType: data.callType || 'video' });
  });

  socket.on('call_answer', async (data) => {
    await prisma.callLog.updateMany({
      where: { callerId: data.to, receiverId: profile.id, status: 'ringing' },
      data: { status: 'accepted' },
    });
    emitToUser(data.to, 'call_accepted', { answer: data.answer });
  });

  socket.on('ice_candidate', (data) => {
    emitToUser(data.to, 'ice_candidate', { candidate: data.candidate });
  });

  socket.on('call_rejected', async (data) => {
    await prisma.callLog.updateMany({
      where: { callerId: data.to, receiverId: profile.id, status: 'ringing' },
      data: { status: 'rejected' },
    });
    emitToUser(data.to, 'call_rejected');
  });

  socket.on('end_call', async (data) => {
    await prisma.callLog.updateMany({
      where: {
        OR: [
          { callerId: profile.id, receiverId: data.to },
          { callerId: data.to, receiverId: profile.id },
        ],
        endedAt: null,
      },
      data: { status: 'ended', endedAt: new Date() },
    });
    emitToUser(data.to, 'call_ended');
  });

  socket.on('create_story', async (data) => {
    try {
      await prisma.story.create({
        data: {
          userId: profile.id,
          mediaData: data.mediaData,
          type: data.type || 'image',
          caption: data.caption || null,
        },
      });
      socket.emit('app_error', { message: 'story_created' });
    } catch (err) {
      console.error('[socket] create_story failed', err);
      socket.emit('app_error', { message: 'story_create_failed' });
    }
  });

  socket.on('get_stories', async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const stories = await prisma.story.findMany({
        where: { createdAt: { gte: twentyFourHoursAgo } },
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      });

      const formatted = stories.map((s) => ({
        id: s.id,
        userId: s.userId,
        mediaData: s.mediaData,
        type: s.type,
        caption: s.caption,
        createdAt: s.createdAt.toISOString(),
        viewed: s.viewedBy ? s.viewedBy.includes(profile.id) : false,
        userName: s.user.displayName,
        userAvatar: s.user.avatarUrl,
      }));

      socket.emit('stories_update', formatted);
    } catch (err) {
      console.error('[socket] get_stories failed', err);
      socket.emit('app_error', { message: 'stories_fetch_failed' });
    }
  });

  socket.on('view_story', async (data) => {
    try {
      const story = await prisma.story.findUnique({ where: { id: data.storyId } });
      if (!story) return;
      const viewers = story.viewedBy ? story.viewedBy.split(',') : [];
      if (!viewers.includes(profile.id)) {
        viewers.push(profile.id);
        await prisma.story.update({
          where: { id: data.storyId },
          data: { viewedBy: viewers.join(',') },
        });
      }
    } catch (err) {
      console.error('[socket] view_story failed', err);
    }
  });

  socket.on('add_reaction', async (data) => {
    try {
      await prisma.reaction.create({
        data: { messageId: data.messageId, userId: profile.id, emoji: data.emoji },
      });
      const all = await prisma.reaction.findMany({ where: { messageId: data.messageId } });
      const reactions = aggregateReactions(all, profile.id);
      socket.emit('message_reactions', { messageId: data.messageId, reactions });
      const message = await prisma.message.findUnique({ where: { id: data.messageId } });
      if (message) emitToUser(message.receiverId === profile.id ? message.senderId : message.receiverId, 'message_reactions', { messageId: data.messageId, reactions });
    } catch (err) {
      console.error('[socket] add_reaction failed', err);
    }
  });

  socket.on('remove_reaction', async (data) => {
    try {
      await prisma.reaction.deleteMany({
        where: { messageId: data.messageId, userId: profile.id, emoji: data.emoji },
      });
      const all = await prisma.reaction.findMany({ where: { messageId: data.messageId } });
      const reactions = aggregateReactions(all, profile.id);
      socket.emit('message_reactions', { messageId: data.messageId, reactions });
      const message = await prisma.message.findUnique({ where: { id: data.messageId } });
      if (message) emitToUser(message.receiverId === profile.id ? message.senderId : message.receiverId, 'message_reactions', { messageId: data.messageId, reactions });
    } catch (err) {
      console.error('[socket] remove_reaction failed', err);
    }
  });

  socket.on('get_call_logs', async () => {
    try {
      const logs = await prisma.callLog.findMany({
        where: { OR: [{ callerId: profile.id }, { receiverId: profile.id }] },
        orderBy: { startedAt: 'desc' },
        take: 50,
      });
      socket.emit('call_logs_update', logs.map((l) => ({
        id: l.id,
        callerId: l.callerId,
        receiverId: l.receiverId,
        status: l.status,
        startedAt: l.startedAt.toISOString(),
        endedAt: l.endedAt?.toISOString() || null,
        callType: l.callType || 'video',
      })));
    } catch (err) {
      console.error('[socket] get_call_logs failed', err);
    }
  });

  socket.on('disconnect', async () => {
    const online = onlineUsers.get(profile.id);

    if (online && online.socketId === socket.id) {
      onlineUsers.delete(profile.id);
      const now = new Date();
      await prisma.user.update({ where: { id: profile.id }, data: { lastSeen: now } });
      socket.broadcast.emit('user_offline', { id: profile.id, lastSeen: now.toISOString() });
    }
  });
});

const PORT = Number(process.env.PORT) || 4000;
httpServer.listen(PORT, () => {
  console.info(`KAPLUMBAĞA API running on port ${PORT}`);
});
