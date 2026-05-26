import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CameraOff, Mic, MicOff, PhoneOff, Video } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { socket } from '../services/socket';
import { getIceServers } from '../services/webrtc';

function getMediaErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return t('cameraDenied');
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return t('mediaNotFound');
    if (error.name === 'NotReadableError') return t('mediaAccessError');
  }

  return t('mediaAccessError');
}

const VideoCallPage: React.FC = () => {
  const navigate = useNavigate();
  const otherUser = useAuthStore((state) => state.otherUser);
  const user = useAuthStore((state) => state.user);
  const incomingCall = useCallStore((state) => state.incomingCall);
  const clearCall = useCallStore((state) => state.clear);
  const { t } = useI18n();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const endedRef = useRef(false);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [streamReady, setStreamReady] = useState(false);
  const [callState, setCallState] = useState<'connecting' | 'in-call' | 'ended' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');

  const finishCall = useCallback((notifyPeer: boolean) => {
    if (endedRef.current) return;
    endedRef.current = true;

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setStreamReady(false);

    if (notifyPeer && otherUser) {
      socket.emit('end_call', { to: otherUser.id });
    }
    clearCall();
    setCallState('ended');
    navigate('/chat');
  }, [navigate, otherUser, clearCall]);

  const endCall = useCallback(() => {
    finishCall(true);
  }, [finishCall]);

  useEffect(() => {
    if (!user || !otherUser) return;

    let active = true;
    const isAnswerer = Boolean(incomingCall);

    function createPeerConnection(localStream: MediaStream): RTCPeerConnection {
      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcRef.current = pc;

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', { to: otherUser!.id, candidate: event.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('in-call');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setErrorMsg(t('callFailed'));
          setCallState('error');
        }
      };

      return pc;
    }

    async function startAsCaller() {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) { localStream.getTracks().forEach((tr) => tr.stop()); return; }

        localStreamRef.current = localStream;
        setStreamReady(true);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

        const pc = createPeerConnection(localStream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call_offer', { to: otherUser!.id, offer });
      } catch (err) {
        if (!active) return;
        setErrorMsg(getMediaErrorMessage(err, t));
        setCallState('error');
      }
    }

    async function startAsAnswerer() {
      if (!incomingCall) return;
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) { localStream.getTracks().forEach((tr) => tr.stop()); return; }

        localStreamRef.current = localStream;
        setStreamReady(true);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

        const pc = createPeerConnection(localStream);
        await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call_answer', { to: otherUser!.id, answer });
        clearCall();
      } catch (err) {
        if (!active) return;
        setErrorMsg(getMediaErrorMessage(err, t));
        setCallState('error');
      }
    }

    const onCallAccepted = async (data: { answer: unknown }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit));
      } catch {
        setErrorMsg(t('callFailed'));
        setCallState('error');
      }
    };

    const onIceCandidate = async (data: { candidate: unknown }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit));
      } catch {
        // ignored — candidate may arrive before remote description
      }
    };

    const onCallEnded = () => {
      finishCall(false);
    };

    socket.on('call_accepted', onCallAccepted);
    socket.on('ice_candidate', onIceCandidate);
    socket.on('call_ended', onCallEnded);

    if (isAnswerer) {
      startAsAnswerer();
    } else {
      startAsCaller();
    }

    return () => {
      active = false;
      socket.off('call_accepted', onCallAccepted);
      socket.off('ice_candidate', onIceCandidate);
      socket.off('call_ended', onCallEnded);

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      localStreamRef.current = null;

      if (!endedRef.current && otherUser) {
        socket.emit('end_call', { to: otherUser.id });
      }
    };
  }, [clearCall, finishCall, incomingCall, navigate, otherUser, t, user]);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setMicOn((current) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !current;
      });
      return !current;
    });
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setCamOn((current) => {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !current;
      });
      return !current;
    });
  };

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="flex h-[100dvh] flex-col bg-gray-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-gray-950/95 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-turtle-600 text-sm font-bold">
            {otherUser?.avatar || '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{otherUser?.displayName || t('unknownUser')}</p>
            <p className="text-xs text-gray-400">
              {callState === 'connecting' ? t('connecting') : callState === 'in-call' ? t('inCall') : ''}
            </p>
          </div>
        </div>
      </header>

      <div className="relative flex-1 bg-gray-900">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        {callState !== 'in-call' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-800 text-3xl font-bold text-gray-400">
              {otherUser?.avatar || '?'}
            </div>
            <p className="mt-4 text-sm text-gray-400">
              {callState === 'connecting' ? t('connecting') : errorMsg}
            </p>
          </div>
        )}

        <div className="absolute bottom-20 right-4 h-32 w-24 overflow-hidden rounded-lg border border-white/20 bg-black shadow-lg sm:h-40 sm:w-32">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-gray-400">
              <CameraOff className="h-6 w-6" />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-3 border-t border-white/10 bg-gray-950 px-4 py-4">
        <button
          type="button"
          onClick={toggleMic}
          disabled={!streamReady}
          className={`rounded-full p-4 text-white transition disabled:opacity-40 ${
            micOn ? 'bg-white/15 hover:bg-white/25' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={micOn ? t('micOff') : t('micOn')}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={toggleCam}
          disabled={!streamReady}
          className={`rounded-full p-4 text-white transition disabled:opacity-40 ${
            camOn ? 'bg-white/15 hover:bg-white/25' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={camOn ? t('cameraOff') : t('cameraOn')}
        >
          {camOn ? <Video className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={endCall}
          className="rounded-full bg-red-600 p-4 text-white transition hover:bg-red-700"
          title={t('endCall')}
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </main>
  );
};

export default VideoCallPage;
