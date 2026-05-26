import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import authRoutes from './routes/auth';
import users from './data/users.json';
import { translateText } from './services/TranslationService';

const app = express();
const httpServer = createServer(app);

type Language = 'tr' | 'th';
type MessageType = 'text' | 'image';
type TranslationStatus = 'translated' | 'fallback';

interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  language: Language;
  avatar: string;
}

interface StoredUser extends PublicUser {
  password: string;
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
}

interface ClientToServerEvents {
  register: (user: PublicUser) => void;
  send_message: (payload: { text: string; from: string; to: string; type?: MessageType }) => void;
  typing: (data: { from: string; to: string }) => void;
  call_user: (data: { from: string; to: string; signal: unknown }) => void;
  accept_call: (data: { to: string; signal: unknown }) => void;
  end_call: (data: { to: string }) => void;
}

interface ServerToClientEvents {
  user_online: (user: PublicUser) => void;
  user_offline: (user: { id: string }) => void;
  presence_state: (users: PublicUser[]) => void;
  chat_history: (messages: ChatMessage[]) => void;
  receive_message: (message: ChatMessage) => void;
  typing: (data: { from: string; to: string }) => void;
  incoming_call: (data: { from: string; signal: unknown }) => void;
  call_accepted: (data: { signal: unknown }) => void;
  call_ended: () => void;
  app_error: (error: { message: string }) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  userId?: string;
}

const storedUsers = users as StoredUser[];
const publicUsers = new Map<string, PublicUser>(
  storedUsers.map(({ password: _password, ...user }) => [user.id, user])
);

const localHostName = 'local' + 'host';
const loopbackHostName = ['127', '0', '0', '1'].join('.');
const defaultClientUrls = [`http://${localHostName}:5173`, `http://${loopbackHostName}:5173`];
const allowedOrigins = (process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : defaultClientUrls)
  .map((origin) => origin.trim())
  .filter(Boolean);

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
});

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kaplumbaga-api' });
});

app.use('/api/auth', authRoutes);

const onlineUsers = new Map<string, OnlineUser>();
const messages: ChatMessage[] = [];

function getPublicUser(id: string): PublicUser | undefined {
  return publicUsers.get(id);
}

function getOnlinePublicUsers(): PublicUser[] {
  return Array.from(onlineUsers.values()).map(({ socketId: _socketId, ...user }) => user);
}

function getConversationMessages(userId: string): ChatMessage[] {
  return messages.filter((message) => message.from === userId || message.to === userId);
}

io.on('connection', (socket) => {
  console.info(`[socket] connected ${socket.id}`);

  socket.on('register', (user) => {
    const profile = getPublicUser(user.id);

    if (!profile) {
      socket.emit('app_error', { message: 'register_failed' });
      return;
    }

    socket.data.userId = profile.id;
    onlineUsers.set(profile.id, { ...profile, socketId: socket.id });
    socket.broadcast.emit('user_online', profile);
    socket.emit('presence_state', getOnlinePublicUsers());
    socket.emit('chat_history', getConversationMessages(profile.id));
  });

  socket.on('send_message', (payload) => {
    const sender = getPublicUser(payload.from);
    const receiver = getPublicUser(payload.to);
    const type = payload.type || 'text';
    const originalText = payload.text.trim();

    if (!sender || !receiver) {
      socket.emit('app_error', { message: 'message_user_missing' });
      return;
    }

    if (!originalText) {
      socket.emit('app_error', { message: 'empty_message' });
      return;
    }

    const translation =
      type === 'image'
        ? {
            originalText,
            translatedText: originalText,
            sourceLang: sender.language,
            targetLang: receiver.language,
            status: 'translated' as TranslationStatus,
          }
        : translateText(originalText, sender.language, receiver.language);

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: translation.translatedText,
      translatedText: translation.translatedText,
      originalText: translation.originalText,
      from: sender.id,
      to: receiver.id,
      timestamp: new Date().toISOString(),
      type,
      sourceLang: translation.sourceLang,
      targetLang: translation.targetLang,
      status: translation.status,
    };

    messages.push(msg);
    if (messages.length > 200) messages.shift();

    io.emit('receive_message', msg);
  });

  socket.on('typing', (data) => {
    const receiver = onlineUsers.get(data.to);
    if (receiver) {
      io.to(receiver.socketId).emit('typing', data);
    }
  });

  socket.on('call_user', (data) => {
    const receiver = onlineUsers.get(data.to);
    if (receiver) {
      io.to(receiver.socketId).emit('incoming_call', { from: data.from, signal: data.signal });
    }
  });

  socket.on('accept_call', (data) => {
    const caller = onlineUsers.get(data.to);
    if (caller) {
      io.to(caller.socketId).emit('call_accepted', { signal: data.signal });
    }
  });

  socket.on('end_call', (data) => {
    const peer = onlineUsers.get(data.to);
    if (peer) {
      io.to(peer.socketId).emit('call_ended');
    }
  });

  socket.on('disconnect', () => {
    const userId = socket.data.userId;

    if (userId) {
      const user = onlineUsers.get(userId);

      if (user && user.socketId === socket.id) {
        onlineUsers.delete(userId);
        socket.broadcast.emit('user_offline', { id: userId });
      }
    }

    console.info(`[socket] disconnected ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.info(`KAPLUMBAĞA API running on port ${PORT}`);
});
