import React, { useState, useRef, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  onAudioRecorded: (base64Audio: string) => void;
}

const VoiceRecorder: React.FC<Props> = ({ onAudioRecorded }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const { t } = useI18n();

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          onAudioRecorded(base64);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Voice recording failed:', err);
      alert(t('microphoneDenied'));
    }
  }, [onAudioRecorded, stopRecording, t]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center">
      {isRecording && (
        <span className="mr-2 text-xs font-medium text-red-500 animate-pulse">
          {formatTime(recordingTime)}
        </span>
      )}
      <button
        type="button"
        onClick={toggleRecording}
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition ${
          isRecording
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title={isRecording ? t('stopRecording') : t('startRecording')}
      >
        {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
    </div>
  );
};

export default VoiceRecorder;
