import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Divider,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAppStore } from '../../store/useAppStore';
import { calculateScore, rankStocks } from '../../engines/scoringEngine';
import { aiScoreStock, type AIScoreData } from '../../services/deepseek';
import type {
  ScoringResult,
  ScoringInput,
  BoardType,
  TechnicalIndicators,
  FundIndicators,
  MacroIndicators,
  FundamentalIndicators,
  EmotionValuationIndicators,
  DataSourceStatus,
  MACDStatus,
  RSIStatus,
  BollingerPosition,
  BollingerBandwidth,
  MAPattern,
  VolumePattern,
  KLinePattern,
  FundDirection,
  ControlLevel,
  EmotionLevel,
} from '../../types';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts';

function RiskDisclaimer() {
  return (
    <Alert severity="warning" sx={{ mt: 3, fontSize: '0.8rem' }}>
      风险提示：AI评分基于模型推理和市场数据，仅供参考，不构成投资建议。数据可能存在延迟或偏差。
    </Alert>
  );
}

/** 将 AI 返回的字符串安全转换为枚举类型 */
function safeCast<T extends string>(value: string, validValues: readonly string[], fallback: T): T {
  return (validValues as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** 将 AI 评分数据转换为评分引擎需要的 ScoringInput */
function convertToScoringInput(ai: AIScoreData): ScoringInput {
  const t = ai.technical;
  const f = ai.fund;
  const m = ai.macro;
  const fn = ai.fundamental;
  const e = ai.emotion;

  const macdValues = ['金叉', '死叉', '零轴上穿', '零轴下穿', '红柱放大', '红柱缩小', '绿柱放大', '绿柱缩小'] as const;
  const rsiValues = ['超买', '超卖', '顶背离', '底背离', '健康', '中性'] as const;
  const bollPosValues = ['中上轨', '中下轨', '上轨附近', '下轨附近', '中轨附近'] as const;
  const bollBwValues = ['扩张', '收窄', '正常'] as const;
  const maValues = ['多头', '空头', '粘合', '分散'] as const;
  const volValues = ['放量', '缩量', '量价配合', '缩量止跌', '放量突破'] as const;
  const kValues = ['锤子线', '空方炮', '阳包阴', '十字星', '大阳线', '大阴线', '无特殊形态'] as const;
  const ctrlValues = ['完全控盘', '高度控盘', '中度控盘', '轻度控盘', '无控盘'] as const;
  const emoValues = ['极度亢奋', '偏亢奋', '中性', '偏悲观', '极度悲观'] as const;
  const dsValues = ['官方已正式披露', '多平台交叉验证', 'UGC来源', '财报延迟披露'] as const;
  const boardValues = ['主板', '创业板', '科创板'] as const;
  const gmValues = ['上升', '持平', '下降'] as const;
  const cfValues = ['正', '负', '持平'] as const;
  const esValues = ['稳健', '一般', '偏差'] as const;

  return {
    stockName: ai.stockName,
    stockCode: ai.stockCode,
    board: safeCast(ai.board, boardValues, '主板' as BoardType),
    currentPrice: ai.currentPrice,
    technical: {
      macdStatus: safeCast(t.macdStatus, macdValues, '金叉' as MACDStatus),
      rsiValue: t.rsiValue,
      rsiStatus: safeCast(t.rsiStatus, rsiValues, '中性' as RSIStatus),
      bollingerPosition: safeCast(t.bollingerPosition, bollPosValues, '中轨附近' as BollingerPosition),
      bollingerBandwidth: safeCast(t.bollingerBandwidth, bollBwValues, '正常' as BollingerBandwidth),
      maPattern: safeCast(t.maPattern, maValues, '多头' as MAPattern),
      volumePattern: safeCast(t.volumePattern, volValues, '量价配合' as VolumePattern),
      kLinePattern: safeCast(t.kLinePattern, kValues, '无特殊形态' as KLinePattern),
    },
    fund: {
      mainForceNetInflow: f.mainForceNetInflow,
      netInflow5d: f.netInflow5d,
      controlLevel: safeCast(f.controlLevel, ctrlValues, '中度控盘' as ControlLevel),
      controlPercent: f.controlPercent,
    },
    macro: {
      industryLogicScore: Math.min(m.industryLogicScore, 15),
      shortTermDiffusionScore: Math.min(m.shortTermDiffusionScore, 5),
      highFrequencyBonus: Math.min(m.highFrequencyBonus, 2),
    },
    fundamental: {
      revenueYoY: fn.revenueYoY,
      netProfitYoY: fn.netProfitYoY,
      grossMarginTrend: safeCast(fn.grossMarginTrend, gmValues, '持平' as const),
      operatingCashFlowDirection: safeCast(fn.operatingCashFlowDirection, cfValues, '正' as const),
      cashFlowMatch: fn.cashFlowMatch,
      earningStability: safeCast(fn.earningStability, esValues, '一般' as const),
    },
    emotion: {
      peTtmPercentile: e.peTtmPercentile,
      dividendYield: e.dividendYield,
      targetPriceDiff: e.targetPriceDiff,
      emotionLevel: safeCast(e.emotionLevel, emoValues, '中性' as EmotionLevel),
    },
    // 数据可信度自动降级：如果基本面关键数据全为0，强制降级为UGC来源
    dataSourceStatus: (() => {
      const declared = safeCast(ai.dataSourceStatus, dsValues, '多平台交叉验证' as DataSourceStatus);
      // 如果营收和净利同比都是0，说明AI没查到真实财报数据
      const noFundamentalData = fn.revenueYoY === 0 && fn.netProfitYoY === 0;
      // 如果资金面主力净流入为0且5日流入也为0，说明没查到真实资金流向
      const noFundData = f.mainForceNetInflow === 0 && f.netInflow5d === 0;
      if (noFundamentalData && noFundData) return 'UGC来源' as DataSourceStatus;
      if (noFundamentalData) return '财报延迟披露' as DataSourceStatus;
      return declared;
    })(),
  };
}

export default function StockScoring() {
  const {
    candidatePool, removeFromCandidatePool,
    scoringResults, setScoringResults,
    apiKey, baseUrl, modelName, useWebSearch,
    setActiveTab,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentStockName, setCurrentStockName] = useState('');
  const [error, setError] = useState('');
  const [selectedRadar, setSelectedRadar] = useState<number>(0);

  const handleAIScoring = async () => {
    if (!apiKey.trim()) {
      setError('请先在选股模块配置 API Key');
      return;
    }
    if (candidatePool.length === 0) {
      setError('候选池为空，请先执行 AI 选股');
      return;
    }

    setLoading(true);
    setError('');
    setProgress({ current: 0, total: candidatePool.length });
    setCurrentStockName('');

    const config = { apiKey, baseUrl, modelName, useWebSearch };
    const results: ScoringResult[] = [];

    for (let i = 0; i < candidatePool.length; i++) {
      const stock = candidatePool[i];
      setCurrentStockName(stock.name);
      setProgress({ current: i + 1, total: candidatePool.length });

      let data: AIScoreData | null = null;
      let lastError = '';

      // 重试机制：失败时最多重试1次
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await aiScoreStock(config, stock);
          if (res.data) {
            data = res.data;
            break;
          }
          lastError = 'AI返回数据格式错误';
        } catch (err) {
          lastError = err instanceof Error ? err.message : '未知错误';
        }
        if (attempt === 0) {
          // 重试前等待 1.5 秒，避免限流
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (data) {
        const input = convertToScoringInput(data);
        const result = calculateScore(input);
        results.push(result);
      } else {
        results.push({
          stockName: stock.name,
          stockCode: stock.code,
          totalScore: 0,
          dimensions: [],
          recommendation: '不推荐',
          dataSourceWarning: `评分失败: ${lastError}`,
        });
      }

      // 逐股间隔 800ms，避免 API 限流
      if (i < candidatePool.length - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    const ranked = rankStocks(results);
    setScoringResults(ranked);
    setLoading(false);
    setCurrentStockName('');
  };

  const recColor = (rec: ScoringResult['recommendation']) => {
    if (rec === '首选') return 'success' as const;
    if (rec === '次选') return 'info' as const;
    if (rec === '备选') return 'warning' as const;
    return 'error' as const;
  };

  const radarData = scoringResults.length > 0 && selectedRadar < scoringResults.length
    ? scoringResults[selectedRadar].dimensions.map((d) => ({
        dimension: d.name,
        score: d.score,
        maxScore: d.maxScore,
      }))
    : [];

  return (
    <Box>
      {/* 候选池概览 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>候选股票池</Typography>
          {candidatePool.length === 0 ? (
            <Alert severity="info">
              候选池为空。请先在「AI选股」模块执行选股，或手动添加候选股。
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                共 {candidatePool.length} 只候选股票，点击下方按钮 AI 自动评分
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {candidatePool.map((stock) => (
                  <Chip
                    key={stock.code}
                    label={`${stock.name} (${stock.code})`}
                    variant="outlined"
                    onDelete={() => removeFromCandidatePool(stock.code)}
                    size="small"
                  />
                ))}
              </Box>
            </>
          )}

          {/* AI 评分按钮 */}
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            {loading ? (
              <Box sx={{ width: '100%' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  正在分析：{currentStockName}（{progress.current}/{progress.total}）
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(progress.current / progress.total) * 100}
                  sx={{ mb: 1 }}
                />
              </Box>
            ) : (
              <Button
                variant="contained"
                size="large"
                startIcon={<AssessmentIcon />}
                onClick={handleAIScoring}
                disabled={candidatePool.length === 0}
                sx={{ px: 6, py: 1.5, fontSize: '1.1rem' }}
              >
                AI 一键评分
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* 评分结果 */}
      {scoringResults.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>评分结果（按总分排名）</Typography>

          {/* 雷达图 — 可切换股票 */}
          {radarData.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  {scoringResults.map((r, i) => (
                    <Chip
                      key={r.stockCode}
                      label={`${r.stockName} ${r.totalScore.toFixed(1)}分`}
                      color={i === selectedRadar ? 'primary' : 'default'}
                      onClick={() => setSelectedRadar(i)}
                      clickable
                      size="small"
                    />
                  ))}
                </Box>
                <Typography variant="subtitle2" gutterBottom>
                  雷达图 — {scoringResults[selectedRadar].stockName}（总分 {scoringResults[selectedRadar].totalScore.toFixed(2)}）
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dimension" />
                    <PolarRadiusAxis angle={30} domain={[0, 35]} />
                    <Radar name="得分" dataKey="score" stroke="#4fc3f7" fill="#4fc3f7" fillOpacity={0.3} />
                    <Radar name="满分" dataKey="maxScore" stroke="#f48fb1" fill="#f48fb1" fillOpacity={0.1} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 评分总表 */}
          <TableContainer component={Card} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>排名</TableCell>
                  <TableCell>股票</TableCell>
                  <TableCell>代码</TableCell>
                  <TableCell>技术面</TableCell>
                  <TableCell>资金面</TableCell>
                  <TableCell>宏观</TableCell>
                  <TableCell>基本面</TableCell>
                  <TableCell>情绪</TableCell>
                  <TableCell>总分</TableCell>
                  <TableCell>推荐</TableCell>
                  <TableCell>数据警告</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scoringResults.map((r, i) => (
                  <TableRow key={r.stockCode} hover onClick={() => setSelectedRadar(i)} sx={{ cursor: 'pointer' }}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell><strong>{r.stockName}</strong></TableCell>
                    <TableCell>{r.stockCode}</TableCell>
                    <TableCell>{r.dimensions.find(d => d.name === '技术面')?.score.toFixed(1) ?? '—'}</TableCell>
                    <TableCell>{r.dimensions.find(d => d.name === '资金面')?.score.toFixed(1) ?? '—'}</TableCell>
                    <TableCell>{r.dimensions.find(d => d.name === '宏观/产业')?.score.toFixed(1) ?? '—'}</TableCell>
                    <TableCell>{r.dimensions.find(d => d.name === '基本面')?.score.toFixed(1) ?? '—'}</TableCell>
                    <TableCell>{r.dimensions.find(d => d.name === '情绪/估值')?.score.toFixed(1) ?? '—'}</TableCell>
                    <TableCell><strong>{r.totalScore.toFixed(2)}</strong></TableCell>
                    <TableCell><Chip label={r.recommendation} color={recColor(r.recommendation)} size="small" /></TableCell>
                    <TableCell>{r.dataSourceWarning ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 每只股票详细评分 */}
          {scoringResults.map((r) => (
            <Card key={r.stockCode} sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  {r.stockName} ({r.stockCode}) — 总分 {r.totalScore.toFixed(2)}
                </Typography>
                {r.dimensions.map((d) => (
                  <Box key={d.name} sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {d.name}: {d.score.toFixed(2)}/{d.maxScore} ({(d.weight * 100).toFixed(0)}%)
                    </Typography>
                    {d.details.map((det, j) => (
                      <Box key={j} sx={{ pl: 2 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{det}</Typography>
                      </Box>
                    ))}
                  </Box>
                ))}
              </CardContent>
            </Card>
          ))}

          <Divider sx={{ my: 2 }} />
          <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => setActiveTab('strategy')}>
            进入策略模块
          </Button>
        </>
      )}

      <RiskDisclaimer />
    </Box>
  );
}
