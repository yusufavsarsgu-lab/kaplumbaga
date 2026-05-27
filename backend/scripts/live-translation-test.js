const { io } = require('socket.io-client');

const API_URL = 'https://kaplumbaga-api.onrender.com';

async function test() {
  // 1. Login as Yusuf
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Yusuf', password: '123456' }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.log('Login failed:', loginData);
    return;
  }
  const token = loginData.token;
  const myId = loginData.user.id;
  console.log('Login OK, myId:', myId);

  // 2. Connect socket
  const socket = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    socket.emit('register');

    // Send to Neeja (user-neeja) to test translation tr->th
    setTimeout(() => {
      console.log('Sending: Seni seviyorum -> to: user-neeja');
      socket.emit('send_message', { text: 'Seni seviyorum', to: 'user-neeja' });
    }, 1000);

    setTimeout(() => {
      console.log('Sending: selam -> to: user-neeja');
      socket.emit('send_message', { text: 'selam', to: 'user-neeja' });
    }, 2000);

    setTimeout(() => {
      console.log('Sending: bugün hava güzel -> to: user-neeja');
      socket.emit('send_message', { text: 'bugün hava güzel', to: 'user-neeja' });
    }, 3000);
  });

  socket.on('receive_message', (msg) => {
    console.log('Received:', {
      text: msg.text,
      originalText: msg.originalText,
      translatedText: msg.translatedText,
      sourceLang: msg.sourceLang,
      targetLang: msg.targetLang,
      status: msg.status,
    });
  });

  socket.on('app_error', (err) => {
    console.log('App error:', err);
  });

  socket.on('connect_error', (err) => {
    console.log('Socket error:', err.message);
  });

  // Wait for responses
  await new Promise((resolve) => setTimeout(resolve, 8000));
  socket.disconnect();
  console.log('Test complete');
}

test().catch(console.error);
