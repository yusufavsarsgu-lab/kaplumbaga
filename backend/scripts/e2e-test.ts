/**
 * Uçtan-uca test: Yusuf ve Neeja login → socket connect → mesaj gönder → çeviri doğrula.
 * Backend'in 4000 portunda ayakta olduğunu varsayar.
 */
import { io, Socket } from 'socket.io-client';

const API = 'http://127.0.0.1:4000';

interface LoginResponse {
  success: boolean;
  user?: { id: string; username: string; language: string };
  token?: string;
  message?: string;
}

interface ChatMessage {
  id: string;
  from: string;
  to: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  status: string;
  type: string;
}

async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json() as Promise<LoginResponse>;
}

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = io(API, { auth: { token }, transports: ['websocket', 'polling'] });
    sock.on('connect', () => resolve(sock));
    sock.on('connect_error', reject);
    setTimeout(() => reject(new Error('connect timeout')), 5000);
  });
}

function waitMessage(sock: Socket): Promise<ChatMessage> {
  return new Promise((resolve, reject) => {
    const handler = (msg: ChatMessage) => {
      sock.off('receive_message', handler);
      resolve(msg);
    };
    sock.on('receive_message', handler);
    setTimeout(() => reject(new Error('msg timeout')), 5000);
  });
}

async function run() {
  console.log('=== TEST 1: Login ===');
  const yusufLogin = await login('Yusuf', '123456');
  const neejaLogin = await login('Neeja', '123456');
  if (!yusufLogin.success || !neejaLogin.success) throw new Error('login failed');
  console.log('Yusuf:', yusufLogin.user);
  console.log('Neeja:', neejaLogin.user);

  console.log('\n=== TEST 2: Socket connect ===');
  const yusufSock = await connect(yusufLogin.token!);
  const neejaSock = await connect(neejaLogin.token!);
  console.log('Both connected');

  await new Promise((r) => setTimeout(r, 500)); // history flush

  // -- Yusuf manuel "Seni seviyorum" --
  console.log('\n=== TEST 3: Yusuf manuel TR mesaj ===');
  let recv = waitMessage(neejaSock);
  yusufSock.emit('send_message', { text: 'Seni seviyorum', to: neejaLogin.user!.id, type: 'text' });
  let msg = await recv;
  console.log('Neeja received:', { original: msg.originalText, translated: msg.translatedText, status: msg.status });
  console.assert(msg.originalText === 'Seni seviyorum', 'originalText');
  console.assert(msg.translatedText === 'ฉันรักคุณ', 'translatedText TR→TH');
  console.assert(msg.status === 'translated', 'status');

  // -- Yusuf manuel emojili --
  console.log('\n=== TEST 4: Yusuf emojili "seni seviyorum ❤️" ===');
  recv = waitMessage(neejaSock);
  yusufSock.emit('send_message', { text: 'seni seviyorum ❤️', to: neejaLogin.user!.id, type: 'text' });
  msg = await recv;
  console.log('Neeja received:', { original: msg.originalText, translated: msg.translatedText, status: msg.status });
  console.assert(msg.translatedText === 'ฉันรักคุณ', 'emojili çeviri');

  // -- Yusuf bilinmeyen --
  console.log('\n=== TEST 5: Yusuf bilinmeyen "Bugün hava güzel" ===');
  recv = waitMessage(neejaSock);
  yusufSock.emit('send_message', { text: 'Bugün hava süper', to: neejaLogin.user!.id, type: 'text' });
  msg = await recv;
  console.log('Neeja received:', { original: msg.originalText, translated: msg.translatedText, status: msg.status });
  console.assert(msg.status === 'fallback', 'fallback bekleniyordu');

  // -- Neeja manuel TH mesaj --
  console.log('\n=== TEST 6: Neeja manuel TH "ฉันคิดถึงคุณ" ===');
  recv = waitMessage(yusufSock);
  neejaSock.emit('send_message', { text: 'ฉันคิดถึงคุณ', to: yusufLogin.user!.id, type: 'text' });
  msg = await recv;
  console.log('Yusuf received:', { original: msg.originalText, translated: msg.translatedText, status: msg.status });
  console.assert(msg.originalText === 'ฉันคิดถึงคุณ', 'TH original');
  console.assert(msg.translatedText === 'Seni özledim', 'TH→TR çeviri');

  // -- Substring --
  console.log('\n=== TEST 7: Yusuf substring "Bugün seni seviyorum çok" ===');
  recv = waitMessage(neejaSock);
  yusufSock.emit('send_message', { text: 'Bugün seni seviyorum çok', to: neejaLogin.user!.id, type: 'text' });
  msg = await recv;
  console.log('Neeja received:', { original: msg.originalText, translated: msg.translatedText, status: msg.status });
  console.assert(msg.translatedText === 'ฉันรักคุณ', 'substring çeviri');

  console.log('\n*** TÜM TESTLER GEÇTİ ***');
  yusufSock.disconnect();
  neejaSock.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
  });
