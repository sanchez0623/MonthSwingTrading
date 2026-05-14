// ============================================================
// 评分引擎 — 5维度量化评分（纯函数）
// ============================================================

import type {
  ScoringInput,
  ScoringResult,
  DimensionScore,
  TechnicalIndicators,
  FundIndicators,
  MacroIndicators,
  FundamentalIndicators,
  EmotionValuationIndicators,
  DataSourceStatus,
} from '../types';

// ---------- 技术面评分 (35分) ----------

function scoreTechnical(t: TechnicalIndicators): DimensionScore {
  const details: string[] = [];
  let score = 0;

  // MACD (0~10)
  const macdScoreMap: Record<string, number> = {
    金叉: 9, 零轴上穿: 8, 红柱放大: 7, 红柱缩小: 4,
    绿柱缩小: 3, 死叉: 1, 零轴下穿: 1, 绿柱放大: 0,
  };
  const macdScore = macdScoreMap[t.macdStatus] ?? 3;
  score += macdScore;
  details.push(`MACD(${t.macdStatus}): ${macdScore}/10`);

  // RSI (0~8)
  let rsiScore = 4;
  if (t.rsiStatus === '健康') rsiScore = 7;
  else if (t.rsiStatus === '中性') rsiScore = 5;
  else if (t.rsiStatus === '底背离') rsiScore = 6;
  else if (t.rsiStatus === '超卖') rsiScore = 5;
  else if (t.rsiStatus === '超买') rsiScore = 3;
  else if (t.rsiStatus === '顶背离') rsiScore = 1;
  score += rsiScore;
  details.push(`RSI(${t.rsiStatus}, ${t.rsiValue.toFixed(2)}): ${rsiScore}/8`);

  // 布林带 (0~5)
  let bollScore = 2;
  if (t.bollingerPosition === '中上轨' && t.bollingerBandwidth === '扩张') bollScore = 4;
  else if (t.bollingerPosition === '中下轨' && t.bollingerBandwidth === '收窄') bollScore = 3;
  else if (t.bollingerPosition === '下轨附近') bollScore = 3;
  else if (t.bollingerPosition === '中轨附近') bollScore = 3;
  else if (t.bollingerPosition === '上轨附近') bollScore = 2;
  score += bollScore;
  details.push(`布林带(${t.bollingerPosition}, ${t.bollingerBandwidth}): ${bollScore}/5`);

  // 均线排列 (0~6)
  const maScoreMap: Record<string, number> = { 多头: 6, 粘合: 3, 分散: 2, 空头: 0 };
  const maScore = maScoreMap[t.maPattern] ?? 2;
  score += maScore;
  details.push(`均线(${t.maPattern}): ${maScore}/6`);

  // 成交量 (0~4)
  const volScoreMap: Record<string, number> = {
    量价配合: 4, 放量突破: 4, 缩量止跌: 3, 放量: 2, 缩量: 2,
  };
  const volScore = volScoreMap[t.volumePattern] ?? 1;
  score += volScore;
  details.push(`量能(${t.volumePattern}): ${volScore}/4`);

  // K线形态 (0~2)
  const kScoreMap: Record<string, number> = {
    阳包阴: 2, 锤子线: 2, 大阳线: 2, 十字星: 1, 空方炮: 0, 大阴线: 0, 无特殊形态: 1,
  };
  const kScore = kScoreMap[t.kLinePattern] ?? 1;
  score += kScore;
  details.push(`K线(${t.kLinePattern}): ${kScore}/2`);

  score = Math.min(score, 35);

  return { name: '技术面', score, maxScore: 35, weight: 0.35, details };
}

// ---------- 资金面评分 (20分) ----------

function scoreFund(f: FundIndicators): DimensionScore {
  const details: string[] = [];
  let score = 0;

  // 主力大单净流入 (0~7)
  if (f.mainForceNetInflow > 5000) { score += 7; details.push('大单大幅流入: 7/7'); }
  else if (f.mainForceNetInflow > 1000) { score += 5; details.push('大单中等流入: 5/7'); }
  else if (f.mainForceNetInflow > 0) { score += 3; details.push('大单小幅流入: 3/7'); }
  else if (f.mainForceNetInflow > -1000) { score += 2; details.push('大单小幅流出: 2/7'); }
  else if (f.mainForceNetInflow > -5000) { score += 1; details.push('大单中等流出: 1/7'); }
  else { score += 0; details.push('大单大幅流出: 0/7'); }

  // 5日累计净流向 (0~6)
  if (f.netInflow5d > 20000) { score += 6; details.push('5日大幅流入: 6/6'); }
  else if (f.netInflow5d > 5000) { score += 4; details.push('5日中等流入: 4/6'); }
  else if (f.netInflow5d > 0) { score += 3; details.push('5日小幅流入: 3/6'); }
  else if (f.netInflow5d > -5000) { score += 1; details.push('5日小幅流出: 1/6'); }
  else { score += 0; details.push('5日大幅流出: 0/6'); }

  // 机构控盘 (0~7)
  const ctrlMap: Record<string, number> = {
    完全控盘: 7, 高度控盘: 5, 中度控盘: 3, 轻度控盘: 1, 无控盘: 0,
  };
  const ctrlScore = ctrlMap[f.controlLevel] ?? 0;
  score += ctrlScore;
  details.push(`控盘(${f.controlLevel}, ${f.controlPercent.toFixed(2)}%): ${ctrlScore}/7`);

  score = Math.min(score, 20);

  return { name: '资金面', score, maxScore: 20, weight: 0.2, details };
}

// ---------- 宏观/产业评分 (20分) ----------

function scoreMacro(m: MacroIndicators): DimensionScore {
  const details: string[] = [];
  const total = Math.min(m.industryLogicScore + m.shortTermDiffusionScore + m.highFrequencyBonus, 20);

  details.push(`中长期产业逻辑: ${m.industryLogicScore}/15`);
  details.push(`短期预期扩散: ${m.shortTermDiffusionScore}/5`);
  details.push(`产业链高频加分: ${m.highFrequencyBonus}/2`);

  return { name: '宏观/产业', score: total, maxScore: 20, weight: 0.2, details };
}

// ---------- 基本面评分 (15分) ----------

function scoreFundamental(f: FundamentalIndicators): DimensionScore {
  const details: string[] = [];
  let score = 0;

  // 营收同比 (0~4)
  if (f.revenueYoY > 30) { score += 4; details.push('营收高增: 4/4'); }
  else if (f.revenueYoY > 10) { score += 3; details.push('营收稳健增长: 3/4'); }
  else if (f.revenueYoY > 0) { score += 2; details.push('营收微增: 2/4'); }
  else { score += 0; details.push('营收下降: 0/4'); }

  // 归母净利同比 (0~4)
  if (f.netProfitYoY > 30) { score += 4; details.push('净利高增: 4/4'); }
  else if (f.netProfitYoY > 10) { score += 3; details.push('净利稳健增长: 3/4'); }
  else if (f.netProfitYoY > 0) { score += 2; details.push('净利微增: 2/4'); }
  else { score += 0; details.push('净利下降: 0/4'); }

  // 毛利率趋势 (0~3)
  const gmMap: Record<string, number> = { 上升: 3, 持平: 2, 下降: 0 };
  const gmScore = gmMap[f.grossMarginTrend] ?? 1;
  score += gmScore;
  details.push(`毛利率(${f.grossMarginTrend}): ${gmScore}/3`);

  // 经营现金流 (0~2)
  if (f.operatingCashFlowDirection === '正' && f.cashFlowMatch) { score += 2; details.push('现金流健康: 2/2'); }
  else if (f.operatingCashFlowDirection === '正') { score += 1; details.push('现金流为正但不匹配: 1/2'); }
  else { score += 0; details.push('现金流为负: 0/2'); }

  // 盈利稳健性 (0~2)
  const esMap: Record<string, number> = { 稳健: 2, 一般: 1, 偏差: 0 };
  const esScore = esMap[f.earningStability] ?? 0;
  score += esScore;
  details.push(`盈利稳健性(${f.earningStability}): ${esScore}/2`);

  score = Math.min(score, 15);

  return { name: '基本面', score, maxScore: 15, weight: 0.15, details };
}

// ---------- 情绪/估值评分 (10分) ----------

function scoreEmotion(e: EmotionValuationIndicators): DimensionScore {
  const details: string[] = [];
  let score = 0;

  // PE分位 (0~3)
  if (e.peTtmPercentile < 20) { score += 3; details.push('PE极低分位: 3/3'); }
  else if (e.peTtmPercentile < 40) { score += 2; details.push('PE低分位: 2/3'); }
  else if (e.peTtmPercentile < 60) { score += 1; details.push('PE中位: 1/3'); }
  else { score += 0; details.push('PE高分位: 0/3'); }

  // 股息率 (0~2)
  if (e.dividendYield > 4) { score += 2; details.push('高股息: 2/2'); }
  else if (e.dividendYield > 2) { score += 1; details.push('中等股息: 1/2'); }
  else { score += 0; details.push('低股息: 0/2'); }

  // 目标价差异 (0~2)
  if (e.targetPriceDiff > 30) { score += 2; details.push('大幅低于目标价: 2/2'); }
  else if (e.targetPriceDiff > 10) { score += 1; details.push('低于目标价: 1/2'); }
  else { score += 0; details.push('接近或高于目标价: 0/2'); }

  // 情绪位置 (0~3)
  const emoMap: Record<string, number> = { 极度悲观: 3, 偏悲观: 2, 中性: 1, 偏亢奋: 0, 极度亢奋: 0 };
  const emoScore = emoMap[e.emotionLevel] ?? 1;
  score += emoScore;
  details.push(`情绪(${e.emotionLevel}): ${emoScore}/3`);

  score = Math.min(score, 10);

  return { name: '情绪/估值', score, maxScore: 10, weight: 0.1, details };
}

// ---------- 数据溯源处理 ----------

function applyDataSourcePenalty(
  dimensions: DimensionScore[],
  status: DataSourceStatus
): { dimensions: DimensionScore[]; warning?: string } {
  if (status === '官方已正式披露') return { dimensions };

  if (status === '多平台交叉验证') {
    const warning = '⚠️ 来源模糊';
    return { dimensions, warning };
  }

  if (status === 'UGC来源') {
    const newDims = dimensions.map((d) => {
      if (d.name === '基本面') return { ...d, score: 0, details: [...d.details, '严禁引用UGC数据，基本面扣至0分'] };
      return d;
    });
    return { dimensions: newDims, warning: '未官方验证' };
  }

  if (status === '财报延迟披露') {
    const newDims = dimensions.map((d) => {
      if (d.name === '基本面') return { ...d, score: 0, details: [...d.details, '尚未官方披露，基本面=0分'] };
      if (d.name === '宏观/产业') return { ...d, score: Math.max(0, d.score - 5), details: [...d.details, '财报延迟，宏观面-5分'] };
      return d;
    });
    return { dimensions: newDims, warning: '尚未官方披露' };
  }

  return { dimensions };
}

// ---------- 主评分函数 ----------

export function calculateScore(input: ScoringInput): ScoringResult {
  const dimensions: DimensionScore[] = [
    scoreTechnical(input.technical),
    scoreFund(input.fund),
    scoreMacro(input.macro),
    scoreFundamental(input.fundamental),
    scoreEmotion(input.emotion),
  ];

  const { dimensions: finalDimensions, warning } = applyDataSourcePenalty(
    dimensions,
    input.dataSourceStatus
  );

  const totalScore = finalDimensions.reduce((sum, d) => sum + d.score, 0);

  let recommendation: ScoringResult['recommendation'] = '不推荐';
  if (totalScore > 80) recommendation = '首选';
  else if (totalScore > 70) recommendation = '次选';
  else if (totalScore > 60) recommendation = '备选';

  return {
    stockName: input.stockName,
    stockCode: input.stockCode,
    totalScore,
    dimensions: finalDimensions,
    recommendation,
    dataSourceWarning: warning,
  };
}

export function rankStocks(results: ScoringResult[]): ScoringResult[] {
  return [...results].sort((a, b) => b.totalScore - a.totalScore).map((r, i) => {
    if (r.totalScore <= 60) return { ...r, recommendation: '不推荐' as const };
    if (i === 0) return { ...r, recommendation: '首选' as const };
    if (i === 1) return { ...r, recommendation: '次选' as const };
    return { ...r, recommendation: '备选' as const };
  });
}
