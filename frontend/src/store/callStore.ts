import { create } from 'zustand';

export type CallMode = 'full' | 'mini';
export type CallType = 'video' | 'audio';

export interface IncomingCall {
  from: string;
  offer: RTCSessionDescriptionInit;
  callType?: CallType;
}

interface CallState {
  incomingCall: IncomingCall | null;
  currentOffer: RTCSessionDescriptionInit | null;
  isInCall: boolean;
  callMode: CallMode;
  callType: CallType;
  setIncomingCall: (call: IncomingCall | null) => void;
  startCall: (type?: CallType) => void;
  endCallState: () => void;
  setCallMode: (mode: CallMode) => void;
  toggleMode: () => void;
  clear: () => void;
}

export const useCallStore = create<CallState>()((set) => ({
  incomingCall: null,
  currentOffer: null,
  isInCall: false,
  callMode: 'full',
  callType: 'video',
  setIncomingCall: (call) => set({ incomingCall: call }),
  startCall: (type = 'video') => set((state) => ({
    isInCall: true,
    callMode: 'full',
    callType: type,
    currentOffer: state.incomingCall?.offer || null,
    incomingCall: null,
  })),
  endCallState: () => set({ isInCall: false, callMode: 'full', callType: 'video', incomingCall: null, currentOffer: null }),
  setCallMode: (mode) => set({ callMode: mode }),
  toggleMode: () => set((s) => ({ callMode: s.callMode === 'full' ? 'mini' : 'full' })),
  clear: () => set({ incomingCall: null, currentOffer: null, isInCall: false, callMode: 'full', callType: 'video' }),
}));
