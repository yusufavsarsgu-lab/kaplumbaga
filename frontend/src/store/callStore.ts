import { create } from 'zustand';

interface IncomingCall {
  from: string;
  offer: RTCSessionDescriptionInit;
}

interface CallState {
  incomingCall: IncomingCall | null;
  setIncomingCall: (call: IncomingCall | null) => void;
  clear: () => void;
}

export const useCallStore = create<CallState>()((set) => ({
  incomingCall: null,
  setIncomingCall: (call) => set({ incomingCall: call }),
  clear: () => set({ incomingCall: null }),
}));
