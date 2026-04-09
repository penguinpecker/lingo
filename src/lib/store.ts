import { create } from 'zustand';
import type { Strategy, Position } from '@/lib/lifi/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  cards?: 'strategies' | 'confirm' | 'success' | 'error';
  data?: unknown;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  walletAddress: string | null;
  hasOnboarded: boolean;

  // Language
  language: string;
  setLanguage: (lang: string) => void;

  // Balances
  balances: Record<string, Record<string, number>>; // chain -> token -> amount
  totalBalance: number;
  isLoadingBalances: boolean;
  setBalances: (b: Record<string, Record<string, number>>) => void;

  // Strategies (computed from engine)
  strategies: { safe: Strategy | null; mix: Strategy | null; bold: Strategy | null };
  isLoadingStrategies: boolean;
  setStrategies: (s: { safe: Strategy | null; mix: Strategy | null; bold: Strategy | null }) => void;

  // Positions
  positions: Position[];
  isLoadingPositions: boolean;
  setPositions: (p: Position[]) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;
  isChatLoading: boolean;
  setChatLoading: (loading: boolean) => void;

  // UI
  activeSheet: string | null;
  sheetData: unknown;
  openSheet: (name: string, data?: unknown) => void;
  closeSheet: () => void;

  // Actions
  setAuth: (authenticated: boolean, wallet: string | null) => void;
  setOnboarded: () => void;
}

export const useStore = create<AppState>((set) => ({
  isAuthenticated: false,
  walletAddress: null,
  hasOnboarded: false,

  language: 'en',
  setLanguage: (lang) => {
    if (typeof window !== 'undefined') localStorage.setItem('lingo_language', lang);
    set({ language: lang });
  },

  balances: {},
  totalBalance: 0,
  isLoadingBalances: false,
  setBalances: (balances) => {
    const total = Object.values(balances).reduce((sum, chain) =>
      sum + Object.values(chain).reduce((s, v) => s + v, 0), 0
    );
    set({ balances, totalBalance: total, isLoadingBalances: false });
  },

  strategies: { safe: null, mix: null, bold: null },
  isLoadingStrategies: false,
  setStrategies: (strategies) => set({ strategies, isLoadingStrategies: false }),

  positions: [],
  isLoadingPositions: false,
  setPositions: (positions) => set({ positions, isLoadingPositions: false }),

  chatMessages: [],
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  clearChat: () => set({ chatMessages: [] }),
  isChatLoading: false,
  setChatLoading: (loading) => set({ isChatLoading: loading }),

  activeSheet: null,
  sheetData: null,
  openSheet: (name, data) => set({ activeSheet: name, sheetData: data }),
  closeSheet: () => set({ activeSheet: null, sheetData: null }),

  setAuth: (authenticated, wallet) => set({ isAuthenticated: authenticated, walletAddress: wallet }),
  setOnboarded: () => {
    if (typeof window !== 'undefined') localStorage.setItem('lingo_hasOnboarded', 'true');
    set({ hasOnboarded: true });
  },
}));
