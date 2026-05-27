import { create } from 'zustand';

export type CallMode = 'full' | 'mini';

export interface IncomingCall {
  from: string;
  offer: RTCSessionDescriptionInit;
}

interface CallState {
  incomingCall: IncomingCall | null;
  currentOffer: RTCSessionDescriptionInit | null;
  isInCall: boolean;
  callMode: CallMode;
  setIncomingCall: (call: IncomingCall | null) => void;
  startCall: () => void;
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
  setIncomingCall: (call) => set({ incomingCall: call }),
  startCall: () => set((state) => ({
    isInCall: true,
    callMode: 'full',
    currentOffer: state.incomingCall?.offer || null,
    incomingCall: null,
  })),
  endCallState: () => set({ isInCall: false, callMode: 'full', incomingCall: null, currentOffer: null }),
  setCallMode: (mode) => set({ callMode: mode }),
  toggleMode: () => set((s) => ({ callMode: s.callMode === 'full' ? 'mini' : 'full' })),
  clear: () => set({ incomingCall: null, currentOffer: null, isInCall: false, callMode: 'full' }),
}));
