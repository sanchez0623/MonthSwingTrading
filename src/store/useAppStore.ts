import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CandidateStock,
  ScreeningResult,
  ScoringResult,
  StrategyResult,
  TabValue,
} from '../types';

interface AppState {
  // 导航
  activeTab: TabValue;
  setActiveTab: (tab: TabValue) => void;

  // 主题
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // 金额单位
  amountUnit: '万元' | '元';
  setAmountUnit: (unit: '万元' | '元') => void;

  // AI API（兼容 OpenAI 格式）
  apiKey: string;
  setApiKey: (key: string) => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  modelName: string;
  setModelName: (name: string) => void;
  useWebSearch: boolean;
  setUseWebSearch: (enabled: boolean) => void;

  // 选股模块
  screeningResult: ScreeningResult | null;
  setScreeningResult: (result: ScreeningResult | null) => void;
  candidatePool: CandidateStock[];
  setCandidatePool: (pool: CandidateStock[]) => void;
  addToCandidatePool: (stock: CandidateStock) => void;
  removeFromCandidatePool: (code: string) => void;

  // 打分模块
  scoringResults: ScoringResult[];
  setScoringResults: (results: ScoringResult[]) => void;

  // 策略模块
  strategyResults: Map<string, StrategyResult>;
  setStrategyResult: (code: string, result: StrategyResult) => void;

  // 时钟模块
  monitoringCodes: string[];
  setMonitoringCodes: (codes: string[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 导航
      activeTab: 'screening',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // 主题
      isDarkMode: true,
      toggleDarkMode: () => set((s) => ({ isDarkMode: !s.isDarkMode })),

      // 金额单位
      amountUnit: '万元',
      setAmountUnit: (unit) => set({ amountUnit: unit }),

      // AI API（兼容 OpenAI 格式）
      apiKey: '',
      setApiKey: (key) => set({ apiKey: key }),
      baseUrl: 'https://api.deepseek.com',
      setBaseUrl: (url) => set({ baseUrl: url }),
      modelName: 'deepseek-chat',
      setModelName: (name) => set({ modelName: name }),
      useWebSearch: true,
      setUseWebSearch: (enabled) => set({ useWebSearch: enabled }),

      // 选股模块
      screeningResult: null,
      setScreeningResult: (result) => set({ screeningResult: result }),
      candidatePool: [],
      setCandidatePool: (pool) => set({ candidatePool: pool }),
      addToCandidatePool: (stock) =>
        set((s) => {
          if (s.candidatePool.find((c) => c.code === stock.code)) return s;
          return { candidatePool: [...s.candidatePool, stock] };
        }),
      removeFromCandidatePool: (code) =>
        set((s) => ({
          candidatePool: s.candidatePool.filter((c) => c.code !== code),
        })),

      // 打分模块
      scoringResults: [],
      setScoringResults: (results) => set({ scoringResults: results }),

      // 策略模块
      strategyResults: new Map(),
      setStrategyResult: (code, result) =>
        set((s) => {
          const newMap = new Map(s.strategyResults);
          newMap.set(code, result);
          return { strategyResults: newMap };
        }),

      // 时钟模块
      monitoringCodes: [],
      setMonitoringCodes: (codes) => set({ monitoringCodes: codes }),
    }),
    {
      name: 'month-swing-trading-store',
      partialize: (state) => ({
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
        modelName: state.modelName,
        useWebSearch: state.useWebSearch,
        isDarkMode: state.isDarkMode,
        amountUnit: state.amountUnit,
        candidatePool: state.candidatePool,
      }),
    }
  )
);
