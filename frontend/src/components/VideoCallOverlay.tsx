import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CameraOff,
  Mic,
  MicOff,
  Minimize2,
  PhoneOff,
  Video,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { socket } from '../services/socket';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const VideoCallOverlay: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const otherUser = useAuthStore((state) => state.otherUser);
  const incomingCall = useCallStore((state) => state.incomingCall);
  const isInCall = useCallStore((state) => state.isInCall);
  const callMode = useCallStore((state) => state.callMode);
  const endCallState = useCallStore((state) => state.endCallState);
  const toggleMode = useCallStore((state) => state.toggleMode);
  const { t } = useI18n();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const endedRef = useRef(false);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [streamReady, setStreamReady] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'in-call' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');

  const endCall = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setStreamReady(false);

    if (otherUser) {
      socket.emit('end_call', { to: otherUser.id });
    }
    endCallState();
  }, [otherUser, endCallState]);

  useEffect(() => {
    if (!isInCall || !user || !otherUser) return;

    endedRef.current = false;
    let active = true;
    const isAnswerer = Boolean(incomingCall);

    function createPeerConnection(localStream: MediaStream): RTCPeerConnection {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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
          setCallStatus('in-call');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setErrorMsg(t('callFailed'));
          setCallStatus('error');
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
        socket.emit('call_offer', { from: user!.id, to: otherUser!.id, offer });
      } catch (err) {
        if (!active) return;
        setErrorMsg(err instanceof Error ? err.message : t('mediaAccessError'));
        setCallStatus('error');
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
      } catch (err) {
        if (!active) return;
        setErrorMsg(err instanceof Error ? err.message : t('mediaAccessError'));
        setCallStatus('error');
      }
    }

    const onCallAccepted = async (data: { answer: unknown }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit));
      } catch {
        setErrorMsg(t('callFailed'));
        setCallStatus('error');
      }
    };

    const onIceCandidate = async (data: { candidate: unknown }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit));
      } catch {
        // ignored
      }
    };

    const onCallEnded = () => {
      if (!endedRef.current) endCall();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInCall, user, otherUser]);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setMicOn((c) => {
      stream.getAudioTracks().forEach((t) => { t.enabled = !c; });
      return !c;
    });
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setCamOn((c) => {
      stream.getVideoTracks().forEach((t) => { t.enabled = !c; });
      return !c;
    });
  };

  if (!isInCall) return null;

  const isMini = callMode === 'mini';

  return (
    <div
      className={`fixed z-50 overflow-hidden bg-black text-white shadow-2xl transition-all duration-300 ${
        isMini
          ? 'bottom-20 right-3 h-40 w-28 cursor-pointer rounded-2xl border-2 border-white/30 hover:scale-105 sm:bottom-24 sm:right-4 sm:h-48 sm:w-36'
          : 'inset-x-0 top-0 flex h-[55dvh] flex-col rounded-none sm:inset-x-auto sm:right-4 sm:top-16 sm:h-[28rem] sm:w-96 sm:rounded-2xl sm:border sm:border-white/10'
      }`}
      onClick={isMini ? toggleMode : undefined}
    >
      {/* Header — only in full mode */}
      {!isMini && (
        <div className="flex items-center justify-between bg-gray-950 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-turtle-600 text-xs font-bold">
              {otherUser?.avatar || '?'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{otherUser?.displayName}</p>
              <p className="text-[10px] text-gray-400">
                {callStatus === 'connecting' ? t('connecting') : callStatus === 'in-call' ? t('inCall') : errorMsg}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMode}
            className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
            title={t('minimize')}
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Video area — always rendered so refs stay alive */}
      <div className={`relative bg-gray-900 ${isMini ? 'h-full w-full' : 'flex-1'}`}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        {callStatus !== 'in-call' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
            <div className={`flex items-center justify-center rounded-full bg-gray-800 font-bold text-gray-400 ${
              isMini ? 'h-10 w-10 text-lg' : 'h-20 w-20 text-2xl'
            }`}>
              {otherUser?.avatar || '?'}
            </div>
            {!isMini && (
              <p className="mt-2 text-xs text-gray-400">
                {callStatus === 'connecting' ? t('connecting') : errorMsg}
              </p>
            )}
          </div>
        )}

        {/* Local video PiP */}
        <div className={`absolute overflow-hidden border border-white/20 bg-black ${
          isMini
            ? 'bottom-1 left-1 h-10 w-8 rounded-md'
            : 'bottom-2 right-2 h-24 w-[4.5rem] rounded-lg shadow-lg sm:h-28 sm:w-20'
        }`}>
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          {!camOn && !isMini && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <CameraOff className="h-4 w-4 text-gray-400" />
            </div>
          )}
        </div>

        {/* Mini mode badge */}
        {isMini && (
          <div className="absolute right-1 top-1 rounded-full bg-green-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
            {callStatus === 'connecting' ? '...' : callStatus === 'in-call' ? t('inCall') : '!'}
          </div>
        )}
      </div>

      {/* Controls — only in full mode */}
      {!isMini && (
        <div className="flex items-center justify-center gap-2 bg-gray-950 px-3 py-2.5">
          <button
            type="button"
            onClick={toggleMic}
            disabled={!streamReady}
            className={`rounded-full p-3 text-white transition disabled:opacity-40 ${
              micOn ? 'bg-white/15 hover:bg-white/25' : 'bg-red-600 hover:bg-red-700'
            }`}
            title={micOn ? t('micOff') : t('micOn')}
          >
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={toggleCam}
            disabled={!streamReady}
            className={`rounded-full p-3 text-white transition disabled:opacity-40 ${
              camOn ? 'bg-white/15 hover:bg-white/25' : 'bg-red-600 hover:bg-red-700'
            }`}
            title={camOn ? t('cameraOff') : t('cameraOn')}
          >
            {camOn ? <Video className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={endCall}
            className="rounded-full bg-red-600 p-3 text-white transition hover:bg-red-700"
            title={t('endCall')}
          >
            <PhoneOff className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleMode}
            className="rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25"
            title={t('minimize')}
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoCallOverlay;
