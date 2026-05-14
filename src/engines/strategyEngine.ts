// ============================================================
// 策略引擎 — 模式匹配 + 仓位计算 + 止盈止损
// ============================================================

import type {
  StrategyInput,
  StrategyResult,
  PositionMode,
  PositionStep,
  StopLossTakeProfitRule,
  ProfitProtection,
  RevenueMatrixRow,
  OpenLevel,
  BoardType,
} from '../types';
import { POSITION_MODE_RATIOS, POSITION_MODE_LABELS } from '../types';

// ---------- 五大加仓模式匹配 ----------

function matchPositionMode(input: StrategyInput): PositionMode | null {
  const { macdStatus, rsiValue, bollingerPosition, maPattern, fundDirection } = input;

  // A·正金字塔加仓
  if (
    (macdStatus === '零轴上穿' || macdStatus === '金叉') &&
    maPattern === '多头' &&
    (fundDirection === '大幅流入' || fundDirection === '小幅流入') &&
    rsiValue < 75
  ) {
    return 'A';
  }

  // B·小仓试探+重仓确认
  if (
    rsiValue < 50 &&
    (fundDirection === '大幅流出' || fundDirection === '小幅流出') &&
    (bollingerPosition === '下轨附近' || bollingerPosition === '中下轨')
  ) {
    return 'B';
  }

  // C·等比例分批加仓
  if (
    (macdStatus === '金叉' || macdStatus === '零轴上穿') &&
    (maPattern === '多头' || maPattern === '粘合') &&
    (fundDirection === '小幅流入' || fundDirection === '持平') &&
    rsiValue >= 45 && rsiValue <= 60
  ) {
    return 'C';
  }

  // D·回调网格加仓
  if (
    (macdStatus === '金叉' || macdStatus === '红柱缩小') &&
    (maPattern === '多头') &&
    (bollingerPosition === '中下轨' || bollingerPosition === '下轨附近') &&
    (fundDirection === '小幅流入' || fundDirection === '持平')
  ) {
    return 'D';
  }

  // E·突破确认递增加仓
  if (
    (macdStatus === '金叉' || macdStatus === '红柱放大') &&
    (bollingerPosition === '中轨附近' || bollingerPosition === '中上轨') &&
    maPattern !== '空头'
  ) {
    return 'E';
  }

  // 默认推荐C模式（最保守）
  return 'C';
}

// ---------- 信号冲突裁决 ----------

function checkConflict(input: StrategyInput): string | null {
  const { fundDirection, rsiValue } = input;

  // 组合X：主力持续流入 + RSI>78
  if ((fundDirection === '大幅流入' || fundDirection === '小幅流入') && rsiValue > 78) {
    return '组合X：主力流入+RSI>78 → 暂停加仓，暂不减仓，观察2日';
  }

  // 组合Y：主力持续卖出 + RSI<50
  if ((fundDirection === '大幅流出' || fundDirection === '小幅流出') && rsiValue < 50) {
    return '组合Y：主力卖出+RSI<50 → 不建仓不加仓不抄底，已持仓减至25%';
  }

  return null;
}

// ---------- 首仓开盘应对 ----------

function determineOpenHandling(openType: 'high' | 'low', openPercent: number): {
  level: OpenLevel;
  text: string;
} {
  if (openType === 'high') {
    if (openPercent < 2.3) return { level: 'H1', 'text': `温和高开(${openPercent.toFixed(2)}%)：首仓上限不变，10:00~11:00分笔建仓` };
    if (openPercent < 5.2) return { level: 'H2', 'text': `中等高开(${openPercent.toFixed(2)}%)：首仓上限不变，等15分钟+量价止跌确认` };
    if (openPercent < 9.5) return { level: 'H3', 'text': `显著高开(${openPercent.toFixed(2)}%)：首仓上限×50%，等有效回调+缩量企稳` };
    return { level: 'H4', 'text': `极端高开(${openPercent.toFixed(2)}%)：0%不建仓，全天只看不买` };
  } else {
    if (openPercent < 1.6) return { level: 'L1', 'text': `温和低开(-${openPercent.toFixed(2)}%)：首仓上限不变，竞价1笔+开盘确认1笔` };
    if (openPercent < 3.6) return { level: 'L2', 'text': `显著低开(-${openPercent.toFixed(2)}%)：首仓上限×85%，支撑区分2笔` };
    if (openPercent < 8) return { level: 'L3', 'text': `破中期支撑(-${openPercent.toFixed(2)}%)：首仓上限×40%，需特大单流入确认+尾盘买入` };
    return { level: 'L4', 'text': `破硬止损位(-${openPercent.toFixed(2)}%)：0%不建仓，全天不参与` };
  }
}

// ---------- 一票否决清单 ----------

function checkVeto(): string[] {
  // 这些需要实时市场数据，此处仅返回框架
  return [];
}

// ---------- 板块交易规则适配 ----------

function getBoardRules(board: BoardType): { minShares: number; increment: number } {
  if (board === '科创板') return { minShares: 200, increment: 1 };
  return { minShares: 100, increment: 100 };
}

function adjustShares(shares: number, board: BoardType): number {
  const rules = getBoardRules(board);
  if (shares < rules.minShares) return rules.minShares;
  const remainder = (shares - rules.minShares) % rules.increment;
  if (remainder !== 0) {
    shares = shares - remainder + rules.increment;
  }
  return shares;
}

// ---------- 阶梯仓位计算 ----------

function calculatePositionSteps(
  mode: PositionMode,
  currentPrice: number,
  capitalPool: number,
  board: BoardType,
  stopLossPrice: number,
): PositionStep[] {
  const ratios = POSITION_MODE_RATIOS[mode];
  const steps: PositionStep[] = [];
  let cumulativeShares = 0;
  let cumulativeAmount = 0;

  // 价格梯度假设：每档在当前价基础上偏移一定比例
  const priceOffsets: Record<PositionMode, number[]> = {
    A: [0, -0.02, -0.04, -0.06],   // 正金字塔：越跌越买
    B: [0, -0.03, 0.02, 0.05],      // 试探→确认
    C: [0, -0.02, -0.04, -0.06],    // 等比例
    D: [0, -0.03, -0.05, -0.07],    // 回调网格
    E: [0, 0.02, 0.04, 0.06],       // 突破确认递增
  };

  const offsets = priceOffsets[mode];

  for (let i = 0; i < 4; i++) {
    const price = currentPrice * (1 + offsets[i]);
    if (price <= stopLossPrice) break; // 不在止损价以下建仓

    const amount = capitalPool * ratios[i];
    const rawShares = Math.floor(amount / price);
    const shares = adjustShares(rawShares, board);
    const actualAmount = shares * price;

    cumulativeShares += shares;
    cumulativeAmount += actualAmount;
    const avgCost = cumulativeAmount / cumulativeShares;

    steps.push({
      step: i + 1,
      ratio: ratios[i],
      price: Math.round(price * 100) / 100,
      shares,
      amount: Math.round(actualAmount * 100) / 100,
      cumulativeShares,
      cumulativeAmount: Math.round(cumulativeAmount * 100) / 100,
      avgCost: Math.round(avgCost * 100) / 100,
    });
  }

  return steps;
}

// ---------- 五阶止盈止损 ----------

function buildStopLossTakeProfit(
  currentPrice: number,
  stopLossPrice: number,
  targetPrice: number,
  rsiValue: number,
  fundDirection: string,
  holdingAvgPrice: number,
): StopLossTakeProfitRule[] {
  const rules: StopLossTakeProfitRule[] = [];

  // 1. 硬止损（最高优先级）
  rules.push({
    level: 1,
    name: '硬止损',
    condition: `价格 ≤ ${stopLossPrice.toFixed(2)}`,
    action: '全部清仓',
    priority: 1,
  });

  // 2. X组合暂停
  if ((fundDirection === '大幅流入' || fundDirection === '小幅流入') && rsiValue > 78) {
    rules.push({
      level: 2,
      name: 'X组合暂停',
      condition: '主力流入 + RSI>78',
      action: '暂停加仓，暂不减仓，观察2日',
      priority: 2,
    });
  }

  // 3. Y组合减仓
  if ((fundDirection === '大幅流出' || fundDirection === '小幅流出') && rsiValue < 50) {
    rules.push({
      level: 3,
      name: 'Y组合减仓',
      condition: '主力卖出 + RSI<50',
      action: '减至25%',
      priority: 3,
    });
  }

  // 4. 移动止损（按盈亏比分档）
  const floatingPnL = currentPrice - holdingAvgPrice;
  const floatingPnLRate = floatingPnL / holdingAvgPrice;
  if (floatingPnLRate > 0.1) {
    rules.push({
      level: 4,
      name: '移动止损',
      condition: `浮盈>10%，保本线=${(holdingAvgPrice * 1.03).toFixed(2)}`,
      action: '强制降至50%',
      priority: 4,
    });
  } else if (floatingPnLRate > 0.05) {
    rules.push({
      level: 4,
      name: '移动止损',
      condition: `浮盈5%~10%，止损观察=前10日最低收盘价`,
      action: '暂不减仓，密切关注',
      priority: 4,
    });
  }

  // 5. RSI顶背离
  rules.push({
    level: 5,
    name: 'RSI顶背离',
    condition: '股价新高RSI未新高',
    action: '减至50%',
    priority: 5,
  });

  // 6. 止盈1·过热
  if (rsiValue > 78) {
    rules.push({
      level: 6,
      name: '止盈1·过热',
      condition: `RSI=${rsiValue.toFixed(2)}>78 + 主力净流出`,
      action: '动态减仓(浮盈越厚减仓越果断)',
      priority: 6,
    });
  }

  // 7. 止盈2·量能衰减
  rules.push({
    level: 7,
    name: '止盈2·量能衰减',
    condition: '连续3天不创新高+成交量缩至5日均量50%以下+RSI跌破65',
    action: '动态再减',
    priority: 7,
  });

  // 8. 止盈3·目标价
  if (targetPrice > 0) {
    rules.push({
      level: 8,
      name: '止盈3·目标价',
      condition: `价格达到目标价 ${targetPrice.toFixed(2)}`,
      action: '可分批止盈',
      priority: 8,
    });
  }

  // 9. 时间止损
  rules.push({
    level: 9,
    name: '时间止损',
    condition: '满15天仍在成本±3%',
    action: '减至25%',
    priority: 9,
  });

  return rules.sort((a, b) => a.priority - b.priority);
}

// ---------- 盈亏比保护 ----------

function buildProfitProtection(
  currentPrice: number,
  holdingAvgPrice: number,
): ProfitProtection[] {
  const floatingPnLRate = holdingAvgPrice > 0
    ? (currentPrice - holdingAvgPrice) / holdingAvgPrice
    : 0;

  return [
    {
      floatingProfitRange: '浮盈≤5%',
      stopLossObservation: '前5日最低收盘价',
      breakEvenLine: '无保本线',
    },
    {
      floatingProfitRange: '浮盈5%~10%',
      stopLossObservation: '前10日最低收盘价',
      breakEvenLine: '无保本线',
    },
    {
      floatingProfitRange: `浮盈>10% (当前${(floatingPnLRate * 100).toFixed(2)}%)`,
      stopLossObservation: '移动止损线',
      breakEvenLine: `持仓均价+3% = ${(holdingAvgPrice * 1.03).toFixed(2)}`,
    },
  ];
}

// ---------- 波段收益矩阵 ----------

function buildRevenueMatrix(
  positionSteps: PositionStep[],
  currentPrice: number,
  capitalPool: number,
  holdingAvgPrice: number,
): RevenueMatrixRow[] {
  const totalShares = positionSteps.reduce((s, p) => s + p.cumulativeShares, 0) || positionSteps[positionSteps.length - 1]?.cumulativeShares || 0;
  const totalCost = positionSteps[positionSteps.length - 1]?.cumulativeAmount || 0;

  // 首仓/半程/满仓三个截面
  const checkpoints = [
    { scenario: '首仓', shares: positionSteps[0]?.cumulativeShares || 0, cost: positionSteps[0]?.cumulativeAmount || 0 },
    { scenario: '半程', shares: positionSteps[1]?.cumulativeShares || 0, cost: positionSteps[1]?.cumulativeAmount || 0 },
    { scenario: '满仓', shares: totalShares, cost: totalCost },
  ];

  const priceScenarios = [
    { label: '止损价-5%', price: currentPrice * 0.95 },
    { label: '当前价', price: currentPrice },
    { label: '目标价+5%', price: currentPrice * 1.05 },
    { label: '目标价+10%', price: currentPrice * 1.10 },
    { label: '目标价+15%', price: currentPrice * 1.15 },
  ];

  const rows: RevenueMatrixRow[] = [];
  for (const cp of checkpoints) {
    for (const ps of priceScenarios) {
      const marketValue = cp.shares * ps.price;
      const floatingPnL = marketValue - cp.cost;
      const returnRate = cp.cost > 0 ? floatingPnL / cp.cost : 0;
      rows.push({
        scenario: `${cp.scenario} | ${ps.label}`,
        price: Math.round(ps.price * 100) / 100,
        marketValue: Math.round(marketValue * 100) / 100,
        floatingPnL: Math.round(floatingPnL * 100) / 100,
        returnRate: Math.round(returnRate * 10000) / 100,
        capitalRatio: capitalPool > 0 ? Math.round((marketValue / (capitalPool * 10000)) * 10000) / 100 : 0,
      });
    }
  }
  return rows;
}

// ---------- 主策略函数 ----------

export function generateStrategy(input: StrategyInput): StrategyResult {
  const conflict = checkConflict(input);
  const matchedMode = matchPositionMode(input) ?? 'C';
  const vetoTriggered = checkVeto();

  // 信号总评
  let signalSummary: StrategyResult['signalSummary'] = 'green';
  let signalSummaryText = '信号良好，可按计划建仓';
  if (conflict) {
    signalSummary = conflict.includes('Y组合') ? 'red' : 'yellow';
    signalSummaryText = conflict;
  }
  if (vetoTriggered.length > 0) {
    signalSummary = 'red';
    signalSummaryText = '一票否决触发：' + vetoTriggered.join('；');
  }

  const positionSteps = calculatePositionSteps(
    matchedMode,
    input.currentPrice,
    input.capitalPool,
    input.board,
    input.stopLossPrice,
  );

  const stopLossTakeProfit = buildStopLossTakeProfit(
    input.currentPrice,
    input.stopLossPrice,
    input.targetPrice,
    input.rsiValue,
    input.fundDirection,
    input.holdingAvgPrice,
  );

  const profitProtection = buildProfitProtection(
    input.currentPrice,
    input.holdingAvgPrice,
  );

  const revenueMatrix = buildRevenueMatrix(
    positionSteps,
    input.currentPrice,
    input.capitalPool,
    input.holdingAvgPrice,
  );

  const monitoringList = [
    `硬止损价: ${input.stopLossPrice.toFixed(2)}`,
    `目标价: ${input.targetPrice.toFixed(2)}`,
    `RSI: ${input.rsiValue.toFixed(2)}`,
    `主力方向: ${input.fundDirection}`,
    `MACD: ${input.macdStatus}`,
  ];

  return {
    signalSummary,
    signalSummaryText,
    matchedMode,
    matchedModeLabel: POSITION_MODE_LABELS[matchedMode],
    conflictResolution: conflict || undefined,
    vetoTriggered: vetoTriggered.length > 0 ? vetoTriggered : undefined,
    positionSteps,
    stopLossTakeProfit,
    profitProtection,
    revenueMatrix,
    monitoringList,
  };
}

export { matchPositionMode, determineOpenHandling, adjustShares, getBoardRules };
