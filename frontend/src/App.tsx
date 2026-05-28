import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { initPushNotifications } from './services/pushNotifications';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import { useSettingsStore } from './store/settingsStore';
import { useCallStore } from './store/callStore';
import { socket } from './services/socket';

function AppRoutes() {
  const theme = useSettingsStore((state) => state.theme);
  const navigate = useNavigate();
  const setIncomingCall = useCallStore((state) => state.setIncomingCall);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    void initPushNotifications();
  }, []);

  useEffect(() => {
    const setupBackButton = async () => {
      await CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          CapApp.minimizeApp();
        }
      });
    };
    setupBackButton();
  }, []);

  useEffect(() => {
    const onIncomingCall = (data: { from: string; offer: unknown; callType?: 'video' | 'audio' }) => {
      setIncomingCall({ from: data.from, offer: data.offer as RTCSessionDescriptionInit, callType: data.callType || 'video' });
      navigate('/chat');
    };
    const onCallEnded = () => {
      setIncomingCall(null);
    };

    socket.on('incoming_call', onIncomingCall);
    socket.on('call_ended', onCallEnded);
    return () => {
      socket.off('incoming_call', onIncomingCall);
      socket.off('call_ended', onCallEnded);
    };
  }, [navigate, setIncomingCall]);

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/video" element={<Navigate to="/chat" replace />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return <AppRoutes />;
}

export default App;
