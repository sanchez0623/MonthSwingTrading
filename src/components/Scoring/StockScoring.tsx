import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Divider,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAppStore } from '../../store/useAppStore';
import { calculateScore, rankStocks } from '../../engines/scoringEngine';
import type {
  ScoringResult,
  TechnicalIndicators,
  FundIndicators,
  MacroIndicators,
  FundamentalIndicators,
  EmotionValuationIndicators,
  DataSourceStatus,
  BoardType,
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
      风险提示：评分结果基于输入指标自动计算，仅供参考。投资决策需结合多方面因素综合判断。
    </Alert>
  );
}

const defaultTechnical: TechnicalIndicators = {
  macdStatus: '金叉', rsiValue: 55, rsiStatus: '中性',
  bollingerPosition: '中轨附近', bollingerBandwidth: '正常',
  maPattern: '多头', volumePattern: '量价配合', kLinePattern: '无特殊形态',
};
const defaultFund: FundIndicators = {
  mainForceNetInflow: 0, netInflow5d: 0,
  controlLevel: '中度控盘', controlPercent: 25,
};
const defaultMacro: MacroIndicators = { industryLogicScore: 8, shortTermDiffusionScore: 2, highFrequencyBonus: 0 };
const defaultFundamental: FundamentalIndicators = {
  revenueYoY: 10, netProfitYoY: 10, grossMarginTrend: '持平',
  operatingCashFlowDirection: '正', cashFlowMatch: true, earningStability: '一般',
};
const defaultEmotion: EmotionValuationIndicators = {
  peTtmPercentile: 50, dividendYield: 2, targetPriceDiff: 10, emotionLevel: '中性',
};

const BoldSubtitle = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>{children}</Typography>
);

export default function StockScoring() {
  const { candidatePool, scoringResults, setScoringResults, setActiveTab } = useAppStore();

  const [stockName, setStockName] = useState('');
  const [stockCode, setStockCode] = useState('');
  const [board, setBoard] = useState<BoardType>('主板');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [technical, setTechnical] = useState<TechnicalIndicators>(defaultTechnical);
  const [fund, setFund] = useState<FundIndicators>(defaultFund);
  const [macro, setMacro] = useState<MacroIndicators>(defaultMacro);
  const [fundamental, setFundamental] = useState<FundamentalIndicators>(defaultFundamental);
  const [emotion, setEmotion] = useState<EmotionValuationIndicators>(defaultEmotion);
  const [dataSource, setDataSource] = useState<DataSourceStatus>('官方已正式披露');

  const importFromPool = () => {
    if (candidatePool.length > 0) {
      const first = candidatePool[0];
      setStockName(first.name);
      setStockCode(first.code);
    }
  };

  const handleScore = () => {
    const input = {
      stockName, stockCode, board, currentPrice,
      technical, fund, macro, fundamental, emotion,
      dataSourceStatus: dataSource,
    };
    const result = calculateScore(input);
    const existing = scoringResults.filter((r) => r.stockCode !== stockCode);
    const ranked = rankStocks([...existing, result]);
    setScoringResults(ranked);
  };

  const radarData = scoringResults.length > 0
    ? scoringResults[0].dimensions.map((d) => ({
        dimension: d.name,
        score: d.score,
        maxScore: d.maxScore,
      }))
    : [];

  const recColor = (rec: ScoringResult['recommendation']) => {
    if (rec === '首选') return 'success' as const;
    if (rec === '次选') return 'info' as const;
    if (rec === '备选') return 'warning' as const;
    return 'error' as const;
  };

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <BoldSubtitle>股票信息</BoldSubtitle>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
            <Button variant="outlined" size="small" onClick={importFromPool} disabled={candidatePool.length === 0}>
              从候选池导入
            </Button>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            <TextField label="股票名称" size="small" value={stockName} onChange={(e) => setStockName(e.target.value)} />
            <TextField label="股票代码" size="small" value={stockCode} onChange={(e) => setStockCode(e.target.value)} />
            <FormControl size="small">
              <InputLabel>板块</InputLabel>
              <Select value={board} label="板块" onChange={(e) => setBoard(e.target.value as BoardType)}>
                <MenuItem value="主板">主板</MenuItem>
                <MenuItem value="创业板">创业板</MenuItem>
                <MenuItem value="科创板">科创板</MenuItem>
              </Select>
            </FormControl>
            <TextField label="当前价格" size="small" type="number" value={currentPrice || ''} onChange={(e) => setCurrentPrice(Number(e.target.value))} />
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <BoldSubtitle>技术面（35分，35%）</BoldSubtitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            <FormControl size="small"><InputLabel>MACD状态</InputLabel>
              <Select value={technical.macdStatus} label="MACD状态" onChange={(e) => setTechnical({ ...technical, macdStatus: e.target.value as MACDStatus })}>
                {['金叉','死叉','零轴上穿','零轴下穿','红柱放大','红柱缩小','绿柱放大','绿柱缩小'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="RSI(14)" size="small" type="number" value={technical.rsiValue} onChange={(e) => setTechnical({ ...technical, rsiValue: Number(e.target.value) })} />
            <FormControl size="small"><InputLabel>RSI状态</InputLabel>
              <Select value={technical.rsiStatus} label="RSI状态" onChange={(e) => setTechnical({ ...technical, rsiStatus: e.target.value as RSIStatus })}>
                {['超买','超卖','顶背离','底背离','健康','中性'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small"><InputLabel>布林带位置</InputLabel>
              <Select value={technical.bollingerPosition} label="布林带位置" onChange={(e) => setTechnical({ ...technical, bollingerPosition: e.target.value as BollingerPosition })}>
                {['中上轨','中下轨','上轨附近','下轨附近','中轨附近'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small"><InputLabel>布林带带宽</InputLabel>
              <Select value={technical.bollingerBandwidth} label="布林带带宽" onChange={(e) => setTechnical({ ...technical, bollingerBandwidth: e.target.value as BollingerBandwidth })}>
                {['扩张','收窄','正常'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small"><InputLabel>均线排列</InputLabel>
              <Select value={technical.maPattern} label="均线排列" onChange={(e) => setTechnical({ ...technical, maPattern: e.target.value as MAPattern })}>
                {['多头','空头','粘合','分散'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small"><InputLabel>成交量</InputLabel>
              <Select value={technical.volumePattern} label="成交量" onChange={(e) => setTechnical({ ...technical, volumePattern: e.target.value as VolumePattern })}>
                {['放量','缩量','量价配合','缩量止跌','放量突破'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small"><InputLabel>K线形态</InputLabel>
              <Select value={technical.kLinePattern} label="K线形态" onChange={(e) => setTechnical({ ...technical, kLinePattern: e.target.value as KLinePattern })}>
                {['锤子线','空方炮','阳包阴','十字星','大阳线','大阴线','无特殊形态'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <BoldSubtitle>资金面（20分，20%）</BoldSubtitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            <TextField label="主力大单净流入(万元)" size="small" type="number" value={fund.mainForceNetInflow} onChange={(e) => setFund({ ...fund, mainForceNetInflow: Number(e.target.value) })} />
            <TextField label="5日累计净流入(万元)" size="small" type="number" value={fund.netInflow5d} onChange={(e) => setFund({ ...fund, netInflow5d: Number(e.target.value) })} />
            <FormControl size="small"><InputLabel>控盘程度</InputLabel>
              <Select value={fund.controlLevel} label="控盘程度" onChange={(e) => setFund({ ...fund, controlLevel: e.target.value as ControlLevel })}>
                {['完全控盘','高度控盘','中度控盘','轻度控盘','无控盘'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="控盘度(%)" size="small" type="number" value={fund.controlPercent} onChange={(e) => setFund({ ...fund, controlPercent: Number(e.target.value) })} />
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <BoldSubtitle>宏观/产业（20分，20%）</BoldSubtitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 2 }}>
            <Box>
              <Typography variant="caption">中长期产业逻辑 ({macro.industryLogicScore}/15)</Typography>
              <Slider value={macro.industryLogicScore} onChange={(_, v) => setMacro({ ...macro, industryLogicScore: v as number })} min={0} max={15} marks step={1} valueLabelDisplay="auto" />
            </Box>
            <Box>
              <Typography variant="caption">短期预期扩散 ({macro.shortTermDiffusionScore}/5)</Typography>
              <Slider value={macro.shortTermDiffusionScore} onChange={(_, v) => setMacro({ ...macro, shortTermDiffusionScore: v as number })} min={0} max={5} marks step={1} valueLabelDisplay="auto" />
            </Box>
            <Box>
              <Typography variant="caption">产业链高频加分 ({macro.highFrequencyBonus}/2)</Typography>
              <Slider value={macro.highFrequencyBonus} onChange={(_, v) => setMacro({ ...macro, highFrequencyBonus: v as number })} min={0} max={2} marks step={1} valueLabelDisplay="auto" />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <BoldSubtitle>基本面（15分，15%）</BoldSubtitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            <TextField label="营收同比(%)" size="small" type="number" value={fundamental.revenueYoY} onChange={(e) => setFundamental({ ...fundamental, revenueYoY: Number(e.target.value) })} />
            <TextField label="归母净利同比(%)" size="small" type="number" value={fundamental.netProfitYoY} onChange={(e) => setFundamental({ ...fundamental, netProfitYoY: Number(e.target.value) })} />
            <FormControl size="small"><InputLabel>毛利率趋势</InputLabel>
              <Select value={fundamental.grossMarginTrend} label="毛利率趋势" onChange={(e) => setFundamental({ ...fundamental, grossMarginTrend: e.target.value as '上升' | '持平' | '下降' })}>
                <MenuItem value="上升">上升</MenuItem><MenuItem value="持平">持平</MenuItem><MenuItem value="下降">下降</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small"><InputLabel>经营现金流</InputLabel>
              <Select value={fundamental.operatingCashFlowDirection} label="经营现金流" onChange={(e) => setFundamental({ ...fundamental, operatingCashFlowDirection: e.target.value as '正' | '负' | '持平' })}>
                <MenuItem value="正">正</MenuItem><MenuItem value="负">负</MenuItem><MenuItem value="持平">持平</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small"><InputLabel>盈利稳健性</InputLabel>
              <Select value={fundamental.earningStability} label="盈利稳健性" onChange={(e) => setFundamental({ ...fundamental, earningStability: e.target.value as '稳健' | '一般' | '偏差' })}>
                <MenuItem value="稳健">稳健</MenuItem><MenuItem value="一般">一般</MenuItem><MenuItem value="偏差">偏差</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <BoldSubtitle>情绪/估值（10分，10%）</BoldSubtitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            <TextField label="PE(TTM)分位(%)" size="small" type="number" value={emotion.peTtmPercentile} onChange={(e) => setEmotion({ ...emotion, peTtmPercentile: Number(e.target.value) })} />
            <TextField label="股息率(%)" size="small" type="number" value={emotion.dividendYield} onChange={(e) => setEmotion({ ...emotion, dividendYield: Number(e.target.value) })} />
            <TextField label="目标价差异(%)" size="small" type="number" value={emotion.targetPriceDiff} onChange={(e) => setEmotion({ ...emotion, targetPriceDiff: Number(e.target.value) })} />
            <FormControl size="small"><InputLabel>情绪位置</InputLabel>
              <Select value={emotion.emotionLevel} label="情绪位置" onChange={(e) => setEmotion({ ...emotion, emotionLevel: e.target.value as EmotionLevel })}>
                {['极度亢奋','偏亢奋','中性','偏悲观','极度悲观'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <BoldSubtitle>数据溯源</BoldSubtitle>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>数据来源状态</InputLabel>
            <Select value={dataSource} label="数据来源状态" onChange={(e) => setDataSource(e.target.value as DataSourceStatus)}>
              <MenuItem value="官方已正式披露">官方已正式披露</MenuItem>
              <MenuItem value="多平台交叉验证">多平台交叉验证</MenuItem>
              <MenuItem value="UGC来源">UGC来源</MenuItem>
              <MenuItem value="财报延迟披露">财报延迟披露</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Button variant="contained" size="large" startIcon={<AssessmentIcon />} onClick={handleScore} sx={{ px: 6, py: 1.5 }}>
          一键评分
        </Button>
      </Box>

      {scoringResults.length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>评分结果</Typography>

          {radarData.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>雷达图 — {scoringResults[0].stockName}</Typography>
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

          <TableContainer component={Card} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>排名</TableCell><TableCell>股票</TableCell><TableCell>代码</TableCell><TableCell>总分</TableCell><TableCell>推荐</TableCell><TableCell>数据警告</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scoringResults.map((r, i) => (
                  <TableRow key={r.stockCode}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{r.stockName}</TableCell>
                    <TableCell>{r.stockCode}</TableCell>
                    <TableCell><strong>{r.totalScore.toFixed(2)}</strong></TableCell>
                    <TableCell><Chip label={r.recommendation} color={recColor(r.recommendation)} size="small" /></TableCell>
                    <TableCell>{r.dataSourceWarning ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {scoringResults.map((r) => (
            <Card key={r.stockCode} sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{r.stockName} ({r.stockCode}) — 总分 {r.totalScore.toFixed(2)}</Typography>
                {r.dimensions.map((d) => (
                  <Box key={d.name} sx={{ mt: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.name}: {d.score.toFixed(2)}/{d.maxScore} ({(d.weight * 100).toFixed(0)}%)</Typography>
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
