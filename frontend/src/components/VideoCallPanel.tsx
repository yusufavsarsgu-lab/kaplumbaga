import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Maximize2, Mic, MicOff, Minimize2, PhoneOff } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  onEnd: () => void;
}

type MediaErrorKey = 'mediaAccessError' | 'mediaUnsupported' | 'mediaNotFound' | 'cameraDenied' | 'microphoneDenied';

function getMediaErrorKey(error: unknown): MediaErrorKey {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'mediaAccessError';
    if (error.name === 'NotFoundError') return 'mediaNotFound';
  }

  return 'mediaAccessError';
}

const VideoCallPanel: React.FC<Props> = ({ onEnd }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [errorKey, setErrorKey] = useState<MediaErrorKey | ''>('');
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    let active = true;
    let localStream: MediaStream | null = null;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('mediaUnsupported');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        if (!active) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStream = mediaStream;
        setStream(mediaStream);
        setErrorKey('');
        setLoading(false);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        if (!active) return;
        setLoading(false);
        setMicOn(false);
        setCamOn(false);
        setErrorKey(error instanceof Error && error.message === 'mediaUnsupported' ? 'mediaUnsupported' : getMediaErrorKey(error));
      }
    }

    startCamera();

    return () => {
      active = false;
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const toggleMic = () => {
    if (!stream) return;
    setMicOn((current) => {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !current;
      });
      return !current;
    });
  };

  const toggleCam = () => {
    if (!stream) return;
    setCamOn((current) => {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !current;
      });
      return !current;
    });
  };

  const endCall = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    onEnd();
  };

  return (
    <section
      className={`relative flex items-center justify-center overflow-hidden bg-gray-900 shadow-2xl shadow-black/30 transition-all ${
        fullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-[72dvh] max-h-[760px] min-h-[420px] w-full max-w-4xl rounded-lg'
      }`}
    >
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

      {(!camOn || !stream) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-center">
          <CameraOff className="h-12 w-12 text-gray-500" />
          <p className="mt-3 text-sm text-gray-300">{loading ? t('waitingCameraPermission') : t('cameraClosed')}</p>
        </div>
      )}

      {errorKey && (
        <div className="absolute left-4 right-4 top-4 rounded-lg border border-red-400/30 bg-red-950/80 px-4 py-3 text-sm text-red-100 backdrop-blur">
          {t(errorKey)}
        </div>
      )}

      <div className="absolute right-3 top-3">
        <button
          type="button"
          onClick={() => setFullscreen((value) => !value)}
          className="rounded-full bg-black/45 p-3 text-white backdrop-blur transition hover:bg-black/65"
          title={fullscreen ? t('minimize') : t('maximize')}
          aria-label={fullscreen ? t('minimize') : t('maximize')}
        >
          {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
      </div>

      <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-3 px-4">
        <button
          type="button"
          onClick={toggleMic}
          disabled={!stream}
          className={`rounded-full p-4 text-white backdrop-blur transition disabled:opacity-40 ${
            micOn ? 'bg-white/15 hover:bg-white/25' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={micOn ? t('micOff') : t('micOn')}
          aria-label={micOn ? t('micOff') : t('micOn')}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={toggleCam}
          disabled={!stream}
          className={`rounded-full p-4 text-white backdrop-blur transition disabled:opacity-40 ${
            camOn ? 'bg-white/15 hover:bg-white/25' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={camOn ? t('cameraOff') : t('cameraOn')}
          aria-label={camOn ? t('cameraOff') : t('cameraOn')}
        >
          {camOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={endCall}
          className="rounded-full bg-red-600 p-4 text-white transition hover:bg-red-700"
          title={t('endCall')}
          aria-label={t('endCall')}
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
};

export default VideoCallPanel;
