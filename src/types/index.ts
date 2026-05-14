// ============================================================
// TypeScript 类型定义 — 月度波段交易系统
// ============================================================

// ---------- 通用 ----------
export type BoardType = '主板' | '创业板' | '科创板';

// ---------- 模块1：AI选股预筛选 ----------

export interface MainTheme {
  name: string;
  logic: string;
}

export interface CandidateStock {
  name: string;
  code: string;
  board: string;
  gain10d: string;
  supportLine: string;
  volumeRatio: number;
  pattern: string;
  highlight: string;
}

export interface ScreeningResult {
  mainThemes: MainTheme[];
  candidates: CandidateStock[];
  analysisDate: string;
  summary: string;
}

// ---------- 模块2：量化打分 ----------

export type MACDStatus = '金叉' | '死叉' | '零轴上穿' | '零轴下穿' | '红柱放大' | '红柱缩小' | '绿柱放大' | '绿柱缩小';
export type RSIStatus = '超买' | '超卖' | '顶背离' | '底背离' | '健康' | '中性';
export type BollingerPosition = '中上轨' | '中下轨' | '上轨附近' | '下轨附近' | '中轨附近';
export type BollingerBandwidth = '扩张' | '收窄' | '正常';
export type MAPattern = '多头' | '空头' | '粘合' | '分散';
export type VolumePattern = '放量' | '缩量' | '量价配合' | '缩量止跌' | '放量突破';
export type KLinePattern = '锤子线' | '空方炮' | '阳包阴' | '十字星' | '大阳线' | '大阴线' | '无特殊形态';
export type FundDirection = '大幅流入' | '小幅流入' | '持平' | '小幅流出' | '大幅流出';
export type ControlLevel = '完全控盘' | '高度控盘' | '中度控盘' | '轻度控盘' | '无控盘';
export type EmotionLevel = '极度亢奋' | '偏亢奋' | '中性' | '偏悲观' | '极度悲观';

export interface TechnicalIndicators {
  macdStatus: MACDStatus;
  rsiValue: number;
  rsiStatus: RSIStatus;
  bollingerPosition: BollingerPosition;
  bollingerBandwidth: BollingerBandwidth;
  maPattern: MAPattern;
  volumePattern: VolumePattern;
  kLinePattern: KLinePattern;
}

export interface FundIndicators {
  mainForceNetInflow: number; // 万元
  netInflow5d: number; // 5日累计净流入 万元
  controlLevel: ControlLevel;
  controlPercent: number; // 控盘度百分比
}

export interface MacroIndicators {
  industryLogicScore: number; // 0~15
  shortTermDiffusionScore: number; // 0~5
  highFrequencyBonus: number; // 0~2
}

export interface FundamentalIndicators {
  revenueYoY: number; // 营收同比增速 %
  netProfitYoY: number; // 归母净利同比增速 %
  grossMarginTrend: '上升' | '持平' | '下降';
  operatingCashFlowDirection: '正' | '负' | '持平';
  cashFlowMatch: boolean; // 经营现金流与利润匹配
  earningStability: '稳健' | '一般' | '偏差';
}

export interface EmotionValuationIndicators {
  peTtmPercentile: number; // PE历史分位 %
  dividendYield: number; // 股息率 %
  targetPriceDiff: number; // 机构目标价与现价差异 %
  emotionLevel: EmotionLevel;
}

export type DataSourceStatus = '官方已正式披露' | '多平台交叉验证' | 'UGC来源' | '财报延迟披露';

export interface ScoringInput {
  stockName: string;
  stockCode: string;
  board: BoardType;
  currentPrice: number;
  technical: TechnicalIndicators;
  fund: FundIndicators;
  macro: MacroIndicators;
  fundamental: FundamentalIndicators;
  emotion: EmotionValuationIndicators;
  dataSourceStatus: DataSourceStatus;
}

export interface DimensionScore {
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  details: string[];
}

export interface ScoringResult {
  stockName: string;
  stockCode: string;
  totalScore: number;
  dimensions: DimensionScore[];
  recommendation: '首选' | '次选' | '备选' | '不推荐';
  dataSourceWarning?: string;
}

// ---------- 模块3：交易策略 ----------

export type PositionMode = 'A' | 'B' | 'C' | 'D' | 'E';
export const POSITION_MODE_LABELS: Record<PositionMode, string> = {
  A: '正金字塔加仓',
  B: '小仓试探+重仓确认',
  C: '等比例分批加仓',
  D: '回调网格加仓',
  E: '突破确认递增加仓',
};
export const POSITION_MODE_RATIOS: Record<PositionMode, number[]> = {
  A: [0.40, 0.30, 0.20, 0.10],
  B: [0.10, 0.40, 0.30, 0.20],
  C: [0.25, 0.25, 0.25, 0.25],
  D: [0.20, 0.30, 0.30, 0.20],
  E: [0.15, 0.35, 0.35, 0.15],
};

export type OpenType = 'high' | 'low';
export type OpenLevel = 'H1' | 'H2' | 'H3' | 'H4' | 'L1' | 'L2' | 'L3' | 'L4';

export interface StrategyInput {
  stockName: string;
  stockCode: string;
  board: BoardType;
  currentPrice: number;
  capitalPool: number; // 资金池 万元
  scoringResult?: ScoringResult;
  // 技术指标
  macdStatus: MACDStatus;
  rsiValue: number;
  bollingerPosition: BollingerPosition;
  maPattern: MAPattern;
  fundDirection: FundDirection;
  // 持仓
  holdingShares: number; // 持有股数
  holdingAvgPrice: number; // 持仓均价
  stopLossPrice: number; // 硬止损价
  targetPrice: number; // 目标价
}

export interface PositionStep {
  step: number;
  ratio: number;
  price: number;
  shares: number;
  amount: number;
  cumulativeShares: number;
  cumulativeAmount: number;
  avgCost: number;
}

export interface StopLossTakeProfitRule {
  level: number;
  name: string;
  condition: string;
  action: string;
  priority: number;
}

export interface ProfitProtection {
  floatingProfitRange: string;
  stopLossObservation: string;
  breakEvenLine: string;
}

export interface StrategyResult {
  signalSummary: 'green' | 'yellow' | 'red';
  signalSummaryText: string;
  matchedMode: PositionMode;
  matchedModeLabel: string;
  conflictResolution?: string;
  openHandling?: OpenLevel;
  openHandlingText?: string;
  vetoTriggered?: string[];
  positionSteps: PositionStep[];
  stopLossTakeProfit: StopLossTakeProfitRule[];
  profitProtection: ProfitProtection[];
  revenueMatrix: RevenueMatrixRow[];
  monitoringList: string[];
}

export interface RevenueMatrixRow {
  scenario: string;
  price: number;
  marketValue: number;
  floatingPnL: number;
  returnRate: number;
  capitalRatio: number;
}

// ---------- 模块4：策略时钟 ----------

export type TimeSlot = '盘前' | '上午' | '上午收盘' | '下午' | '收盘后';

export interface ClockTask {
  timeRange: string;
  slot: TimeSlot;
  goldenTasks: string[];
  junkOperations: string[];
}

export interface MonthlyNode {
  name: string;
  description: string;
  dayOfMonth: number | 'last-week';
}

export interface DailyConsultation {
  timeRange: string;
  name: string;
  tasks: string[];
}

export interface ForbiddenOperation {
  description: string;
  reason: string;
}

// ---------- 全局状态 ----------

export type TabValue = 'screening' | 'scoring' | 'strategy' | 'clock';
