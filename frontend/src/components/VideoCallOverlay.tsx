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
import { useSettingsStore } from '../store/settingsStore';
import { socket } from '../services/socket';
import { getIceServers } from '../services/webrtc';

function waitForIceGatheringComplete(pc: RTCPeerConnection, maxMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    let resolved = false;
    const checkState = () => {
      if (!resolved && pc.iceGatheringState === 'complete') {
        resolved = true;
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', checkState);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }
    }, maxMs);
  });
}

function getMediaErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return t('cameraDenied');
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return t('mediaNotFound');
    if (error.name === 'NotReadableError') return t('mediaAccessError');
  }

  return t('mediaAccessError');
}

const VideoCallOverlay: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const otherUser = useAuthStore((state) => state.otherUser);
  const currentOffer = useCallStore((state) => state.currentOffer);
  const isInCall = useCallStore((state) => state.isInCall);
  const callMode = useCallStore((state) => state.callMode);
  const callType = useCallStore((state) => state.callType);
  const endCallState = useCallStore((state) => state.endCallState);
  const toggleMode = useCallStore((state) => state.toggleMode);
  const { t } = useI18n();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const endedRef = useRef(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const videoFilter = useSettingsStore((state) => state.videoFilter);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [streamReady, setStreamReady] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'in-call' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const callStatusRef = useRef(callStatus);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

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
    endCallState();
  }, [otherUser, endCallState]);

  const endCall = useCallback(() => {
    finishCall(true);
  }, [finishCall]);

  useEffect(() => {
    if (!isInCall || !user || !otherUser) return;

    endedRef.current = false;
    let active = true;
    const isAnswerer = Boolean(currentOffer);

    function createPeerConnection(localStream: MediaStream): RTCPeerConnection {
      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });
      pcRef.current = pc;

      // Önceki buffer'daki candidate'ları ekle (eğer remote description zaten set edilmişse)
      if (pc.remoteDescription && pendingCandidatesRef.current.length > 0) {
        while (pendingCandidatesRef.current.length > 0) {
          const cand = pendingCandidatesRef.current.shift();
          if (cand) {
            try { pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignored */ }
          }
        }
      }

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
          console.log('[WebRTC] sending ICE:', event.candidate.candidate.substring(0, 40) + '...');
          socket.emit('ice_candidate', { to: otherUser!.id, candidate: event.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] connectionState:', pc.connectionState, 'iceConnectionState:', pc.iceConnectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('in-call');
        } else if (pc.connectionState === 'failed') {
          console.error('[WebRTC] Connection FAILED. iceGatheringState:', pc.iceGatheringState);
          setErrorMsg(t('callFailed'));
          setCallStatus('error');
        }
      };

      return pc;
    }

    async function startAsCaller() {
      try {
        console.log('[WebRTC] Caller: getting user media...');
        const constraints = callType === 'audio'
          ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
          : { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
        const localStream = await navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints);
        if (!active) { localStream.getTracks().forEach((tr) => tr.stop()); return; }
        console.log('[WebRTC] Caller: got media stream');

        localStreamRef.current = localStream;
        setStreamReady(true);
        if (localVideoRef.current && callType === 'video') localVideoRef.current.srcObject = localStream;

        const pc = createPeerConnection(localStream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('[WebRTC] Caller: waiting ICE gathering...');
        await waitForIceGatheringComplete(pc);
        console.log('[WebRTC] Caller: ICE complete. Sending offer with', pendingCandidatesRef.current.length, 'buffered candidates');
        if (!active) return;
        socket.emit('call_offer', { to: otherUser!.id, offer: pc.localDescription });
        console.log('[WebRTC] Caller: offer sent');
      } catch (err) {
        console.error('[WebRTC] Caller error:', err);
        if (!active) return;
        setErrorMsg(getMediaErrorMessage(err, t));
        setCallStatus('error');
      }
    }

    async function startAsAnswerer() {
      if (!currentOffer) return;
      try {
        console.log('[WebRTC] Answerer: getting user media...');
        const constraints = callType === 'audio'
          ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
          : { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
        const localStream = await navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints);
        if (!active) { localStream.getTracks().forEach((tr) => tr.stop()); return; }
        console.log('[WebRTC] Answerer: got media stream');

        localStreamRef.current = localStream;
        setStreamReady(true);
        if (localVideoRef.current && callType === 'video') localVideoRef.current.srcObject = localStream;

        const pc = createPeerConnection(localStream);
        console.log('[WebRTC] Answerer: setting remote desc...');
        await pc.setRemoteDescription(new RTCSessionDescription(currentOffer));
        console.log('[WebRTC] Answerer: remote desc set');
        // Remote description set edildikten sonra buffer'daki candidate'ları ekle
        while (pendingCandidatesRef.current.length > 0) {
          const cand = pendingCandidatesRef.current.shift();
          if (cand) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignored */ }
          }
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC] Answerer: waiting ICE gathering...');
        await waitForIceGatheringComplete(pc);
        console.log('[WebRTC] Answerer: ICE complete. Sending answer');
        if (!active) return;
        socket.emit('call_answer', { to: otherUser!.id, answer: pc.localDescription });
        console.log('[WebRTC] Answerer: answer sent');
      } catch (err) {
        console.error('[WebRTC] Answerer error:', err);
        if (!active) return;
        setErrorMsg(getMediaErrorMessage(err, t));
        setCallStatus('error');
      }
    }

    const onCallAccepted = async (data: { answer: unknown }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit));
        // Remote description set edildikten sonra buffer'daki candidate'ları ekle
        while (pendingCandidatesRef.current.length > 0) {
          const cand = pendingCandidatesRef.current.shift();
          if (cand) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignored */ }
          }
        }
      } catch {
        setErrorMsg(t('callFailed'));
        setCallStatus('error');
      }
    };

    const onIceCandidate = async (data: { candidate: unknown }) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        console.log('[WebRTC] buffering ICE (no remoteDesc yet)');
        pendingCandidatesRef.current.push(data.candidate as RTCIceCandidateInit);
        return;
      }
      try {
        console.log('[WebRTC] adding received ICE');
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit));
      } catch {
        // ignored
      }
    };

    const onCallEnded = () => {
      finishCall(false);
    };

    const onCallRejected = () => {
      setErrorMsg(t('callRejected'));
      setCallStatus('error');
      finishCall(false);
    };

    socket.on('call_accepted', onCallAccepted);
    socket.on('call_rejected', onCallRejected);
    socket.on('ice_candidate', onIceCandidate);
    socket.on('call_ended', onCallEnded);

    // 30 saniye içinde bağlanamazsa timeout (TURN relay zaman alabilir)
    timeoutRef.current = window.setTimeout(() => {
      if (callStatusRef.current === 'connecting' && !endedRef.current) {
        setErrorMsg(t('callFailed'));
        setCallStatus('error');
      }
    }, 30000);

    if (isAnswerer) {
      startAsAnswerer();
    } else {
      startAsCaller();
    }

    return () => {
      active = false;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      socket.off('call_accepted', onCallAccepted);
      socket.off('call_rejected', onCallRejected);
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
  }, [finishCall, currentOffer, isInCall, otherUser, t, user]);

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

  const isMini = callMode === 'mini';

  // Android back button - arama sirasinda uygulamayi kapatma, minimize et
  useEffect(() => {
    if (!isInCall) return;
    const handler = (e: Event) => {
      if (!isMini) {
        e.preventDefault();
        toggleMode();
      }
    };
    document.addEventListener('backbutton', handler);
    return () => document.removeEventListener('backbutton', handler);
  }, [isInCall, isMini, toggleMode]);

  if (!isInCall) return null;

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
        {callType === 'video' && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: videoFilter === 'none' ? undefined : videoFilter === 'blur' ? 'blur(4px)' : videoFilter === 'grayscale' ? 'grayscale(100%)' : videoFilter === 'sepia' ? 'sepia(100%)' : videoFilter === 'brightness' ? 'brightness(1.5)' : undefined }}
          />
        )}

        {callType === 'audio' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`flex items-center justify-center rounded-full bg-gray-800 font-bold text-gray-400 ${
              isMini ? 'h-10 w-10 text-lg' : 'h-20 w-20 text-2xl'
            }`}>
              {otherUser?.avatar || '?'}
            </div>
            {!isMini && (
              <p className="mt-2 text-xs text-gray-400">
                {callStatus === 'connecting' ? t('connecting') : callStatus === 'in-call' ? t('inCall') : errorMsg}
              </p>
            )}
          </div>
        )}

        {callStatus !== 'in-call' && callType === 'video' && (
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
        {callType === 'video' && (
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
        )}

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

          {callType === 'video' && (
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
          )}

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
