import React from 'react';
import { X, Phone, PhoneOff, Video } from 'lucide-react';
import { useI18n } from '../i18n';

interface CallLog {
  id: string;
  callerId: string;
  receiverId: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  callType?: string;
}

interface Props {
  logs: CallLog[];
  userId: string;
  otherName: string;
  onClose: () => void;
}

const CallHistoryModal: React.FC<Props> = ({ logs, userId, otherName, onClose }) => {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-800">{t('callHistory')}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">{t('noCalls')}</p>
          ) : (
            logs.map((log) => {
              const isOutgoing = log.callerId === userId;
              const isMissed = log.status === 'rejected' || log.status === 'missed';
              const date = new Date(log.startedAt).toLocaleDateString();
              const time = new Date(log.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const duration = log.endedAt
                ? Math.round((new Date(log.endedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)
                : 0;
              const durText = duration > 60 ? `${Math.floor(duration / 60)} dk ${duration % 60} sn` : `${duration} sn`;

              return (
                <div key={log.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${isMissed ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                    {log.callType === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {isOutgoing ? `${otherName} ${t('calledTo')}` : `${otherName} ${t('calledFrom')}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {date} {time} · {log.status === 'ended' && duration > 0 ? durText : log.status === 'rejected' ? t('rejected') : log.status}
                    </p>
                  </div>
                  {isMissed && <PhoneOff className="h-4 w-4 text-red-400" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CallHistoryModal;
