import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API_URL).replace(/\/$/, '');

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

export function connectSocket(token?: string) {
  const authToken = token ?? useAuthStore.getState().token;
  const previousAuth = socket.auth as { token?: string };

  if (socket.connected && previousAuth.token !== authToken) {
    socket.disconnect();
  }

  socket.auth = authToken ? { token: authToken } : {};
  if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect();
}
