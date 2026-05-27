import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import cors from 'cors';
import authRoutes from './routes/auth';
import { prisma } from './db/prisma';
import { getBearerToken, verifyAuthToken } from './services/AuthService';
import { translateText } from './services/TranslationService';

const app = express();
const httpServer = createServer(app);

type Language = 'tr' | 'th';
type MessageType = 'text' | 'image';
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
  deliveryStatus: DeliveryStatus;
}

interface ClientToServerEvents {
  register: (user?: PublicUser) => void;
  send_message: (payload: { text: string; from?: string; to: string; type?: MessageType }) => void;
  mark_read: (data: { messageIds: string[]; readBy?: string }) => void;
  typing: (data: { from?: string; to: string }) => void;
  call_offer: (data: { from?: string; to: string; offer: unknown }) => void;
  call_answer: (data: { to: string; answer: unknown }) => void;
  ice_candidate: (data: { to: string; candidate: unknown }) => void;
  end_call: (data: { to: string }) => void;
}

interface ServerToClientEvents {
  user_online: (user: PublicUser) => void;
  user_offline: (user: { id: string }) => void;
  presence_state: (users: PublicUser[]) => void;
  chat_history: (messages: ChatMessage[]) => void;
  receive_message: (message: ChatMessage) => void;
  typing: (data: { from: string; to: string }) => void;
  messages_status_updated: (data: { messageIds: string[]; status: DeliveryStatus }) => void;
  incoming_call: (data: { from: string; offer: unknown }) => void;
  call_accepted: (data: { answer: unknown }) => void;
  ice_candidate: (data: { candidate: unknown }) => void;
  call_ended: () => void;
  app_error: (error: { message: string }) => void;
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
  maxHttpBufferSize: 4_500_000,
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '4mb' }));

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
  imageData: string | null;
  imageUrl: string | null;
  deliveryStatus: string;
  createdAt: Date;
}): ChatMessage {
  const type = toMessageType(message.type);
  const originalText = type === 'image' ? message.imageData || message.imageUrl || '' : message.originalText || '';
  const translatedText = type === 'image' ? originalText : message.translatedText || originalText;

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
    deliveryStatus: toDeliveryStatus(message.deliveryStatus),
  };
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

      const deliveryStatus: DeliveryStatus = onlineUsers.has(receiver.id) ? 'delivered' : 'sent';
      const translation =
        type === 'image'
          ? {
              originalText: rawText,
              translatedText: rawText,
              sourceLang: sender.language as Language,
              targetLang: receiver.language as Language,
              status: 'translated' as TranslationStatus,
            }
          : await translateText(rawText, sender.language as Language, receiver.language as Language);

      const created = await prisma.message.create({
        data: {
          senderId: sender.id,
          receiverId: receiver.id,
          type,
          originalText: type === 'image' ? null : translation.originalText,
          translatedText: type === 'image' ? null : translation.translatedText,
          sourceLang: translation.sourceLang,
          targetLang: translation.targetLang,
          translationStatus: translation.status,
          imageData: type === 'image' ? rawText : null,
          deliveryStatus,
        },
      });

      const chatMessage = toChatMessage(created);
      socket.emit('receive_message', chatMessage);
      emitToUser(receiver.id, 'receive_message', chatMessage);
    } catch (error) {
      console.error('[socket] send_message failed', error);
      socket.emit('app_error', { message: 'message_send_failed' });
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
    emitToUser(data.to, 'incoming_call', { from: profile.id, offer: data.offer });
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

  socket.on('disconnect', () => {
    const online = onlineUsers.get(profile.id);

    if (online && online.socketId === socket.id) {
      onlineUsers.delete(profile.id);
      socket.broadcast.emit('user_offline', { id: profile.id });
    }
  });
});

const PORT = Number(process.env.PORT) || 4000;
httpServer.listen(PORT, () => {
  console.info(`KAPLUMBAĞA API running on port ${PORT}`);
});
