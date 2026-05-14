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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Divider,
  Grid,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useAppStore } from '../../store/useAppStore';
import { generateStrategy } from '../../engines/strategyEngine';
import { POSITION_MODE_LABELS } from '../../types';
import type {
  BoardType,
  MACDStatus,
  MAPattern,
  BollingerPosition,
  FundDirection,
  StrategyResult,
} from '../../types';

function RiskDisclaimer() {
  return (
    <Alert severity="warning" sx={{ mt: 3, fontSize: '0.8rem' }}>
      风险提示：策略结果基于输入指标自动生成，不构成投资建议。实际交易请结合市场情况谨慎决策。
    </Alert>
  );
}

export default function TradingStrategy() {
  const { scoringResults, strategyResults, setStrategyResult } = useAppStore();

  // 输入状态
  const [stockName, setStockName] = useState('');
  const [stockCode, setStockCode] = useState('');
  const [board, setBoard] = useState<BoardType>('主板');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [capitalPool, setCapitalPool] = useState(100);
  const [macdStatus, setMacdStatus] = useState<MACDStatus>('金叉');
  const [rsiValue, setRsiValue] = useState(55);
  const [bollingerPosition, setBollingerPosition] = useState<BollingerPosition>('中轨附近');
  const [maPattern, setMaPattern] = useState<MAPattern>('多头');
  const [fundDirection, setFundDirection] = useState<FundDirection>('小幅流入');
  const [holdingShares, setHoldingShares] = useState(0);
  const [holdingAvgPrice, setHoldingAvgPrice] = useState(0);
  const [stopLossPrice, setStopLossPrice] = useState(0);
  const [targetPrice, setTargetPrice] = useState(0);
  const [result, setResult] = useState<StrategyResult | null>(null);

  // 从打分结果导入
  const importFromScoring = () => {
    if (scoringResults.length > 0) {
      const top = scoringResults[0];
      setStockName(top.stockName);
      setStockCode(top.stockCode);
    }
  };

  const handleGenerate = () => {
    const strategyResult = generateStrategy({
      stockName,
      stockCode,
      board,
      currentPrice,
      capitalPool,
      macdStatus,
      rsiValue,
      bollingerPosition,
      maPattern,
      fundDirection,
      holdingShares,
      holdingAvgPrice,
      stopLossPrice,
      targetPrice,
    });
    setResult(strategyResult);
    setStrategyResult(stockCode, strategyResult);
  };

  const signalColor = (s: StrategyResult['signalSummary']) => {
    if (s === 'green') return '#66bb6a';
    if (s === 'yellow') return '#ffa726';
    return '#ef5350';
  };

  return (
    <Box>
      {/* 股票信息 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>标的与资金</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant="outlined" size="small" onClick={importFromScoring} disabled={scoringResults.length === 0}>
              从打分结果导入
            </Button>
          </Box>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField label="股票名称" size="small" fullWidth value={stockName} onChange={(e) => setStockName(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField label="股票代码" size="small" fullWidth value={stockCode} onChange={(e) => setStockCode(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>板块</InputLabel>
                <Select value={board} label="板块" onChange={(e) => setBoard(e.target.value as BoardType)}>
                  <MenuItem value="主板">主板</MenuItem>
                  <MenuItem value="创业板">创业板</MenuItem>
                  <MenuItem value="科创板">科创板</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField label="当前价格" size="small" fullWidth type="number" value={currentPrice || ''} onChange={(e) => setCurrentPrice(Number(e.target.value))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField label="资金池(万元)" size="small" fullWidth type="number" value={capitalPool} onChange={(e) => setCapitalPool(Number(e.target.value))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField label="持有股数" size="small" fullWidth type="number" value={holdingShares} onChange={(e) => setHoldingShares(Number(e.target.value))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField label="持仓均价" size="small" fullWidth type="number" value={holdingAvgPrice || ''} onChange={(e) => setHoldingAvgPrice(Number(e.target.value))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField label="硬止损价" size="small" fullWidth type="number" value={stopLossPrice || ''} onChange={(e) => setStopLossPrice(Number(e.target.value))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField label="目标价" size="small" fullWidth type="number" value={targetPrice || ''} onChange={(e) => setTargetPrice(Number(e.target.value))} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 技术指标 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>技术指标</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>MACD状态</InputLabel>
                <Select value={macdStatus} label="MACD状态" onChange={(e) => setMacdStatus(e.target.value as MACDStatus)}>
                  {['金叉','死叉','零轴上穿','零轴下穿','红柱放大','红柱缩小','绿柱放大','绿柱缩小'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField label="RSI值" size="small" fullWidth type="number" value={rsiValue} onChange={(e) => setRsiValue(Number(e.target.value))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>布林带位置</InputLabel>
                <Select value={bollingerPosition} label="布林带位置" onChange={(e) => setBollingerPosition(e.target.value as BollingerPosition)}>
                  {['中上轨','中下轨','上轨附近','下轨附近','中轨附近'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>均线排列</InputLabel>
                <Select value={maPattern} label="均线排列" onChange={(e) => setMaPattern(e.target.value as MAPattern)}>
                  {['多头','空头','粘合','分散'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>主力方向</InputLabel>
                <Select value={fundDirection} label="主力方向" onChange={(e) => setFundDirection(e.target.value as FundDirection)}>
                  {['大幅流入','小幅流入','持平','小幅流出','大幅流出'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 生成策略 */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Button variant="contained" size="large" startIcon={<TrendingUpIcon />} onClick={handleGenerate} sx={{ px: 6, py: 1.5 }}>
          一键生成策略
        </Button>
      </Box>

      {/* 策略结果 */}
      {result && (
        <>
          {/* 信号总评卡 */}
          <Card sx={{ mb: 2, borderLeft: `4px solid ${signalColor(result.signalSummary)}` }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={result.signalSummary === 'green' ? '🟢' : result.signalSummary === 'yellow' ? '🟡' : '🔴'}
                  sx={{ fontSize: '1.5rem' }}
                />
                <Box>
                  <Typography variant="h6">{result.signalSummaryText}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    匹配模式：{result.matchedModeLabel}（模式{result.matchedMode}）
                  </Typography>
                </Box>
              </Box>
              {result.conflictResolution && (
                <Alert severity="warning" sx={{ mt: 1 }}>{result.conflictResolution}</Alert>
              )}
              {result.vetoTriggered && result.vetoTriggered.length > 0 && (
                <Alert severity="error" sx={{ mt: 1 }}>一票否决：{result.vetoTriggered.join('；')}</Alert>
              )}
            </CardContent>
          </Card>

          {/* 阶梯建仓表 */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>
                阶梯建仓表 — {result.matchedModeLabel}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>档位</TableCell>
                      <TableCell>仓位比例</TableCell>
                      <TableCell>建仓价格</TableCell>
                      <TableCell>股数</TableCell>
                      <TableCell>金额(元)</TableCell>
                      <TableCell>累计股数</TableCell>
                      <TableCell>累计投入(元)</TableCell>
                      <TableCell>综合成本</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.positionSteps.map((step) => (
                      <TableRow key={step.step}>
                        <TableCell>{step.step}</TableCell>
                        <TableCell>{(step.ratio * 100).toFixed(0)}%</TableCell>
                        <TableCell>{step.price.toFixed(2)}</TableCell>
                        <TableCell>{step.shares}</TableCell>
                        <TableCell>{step.amount.toFixed(2)}</TableCell>
                        <TableCell>{step.cumulativeShares}</TableCell>
                        <TableCell>{step.cumulativeAmount.toFixed(2)}</TableCell>
                        <TableCell>{step.avgCost.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* 五阶止盈止损表 */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>五阶止盈止损</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>优先级</TableCell>
                      <TableCell>名称</TableCell>
                      <TableCell>触发条件</TableCell>
                      <TableCell>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.stopLossTakeProfit.map((rule) => (
                      <TableRow key={rule.level}>
                        <TableCell><Chip label={rule.priority} size="small" color={rule.priority <= 2 ? 'error' : rule.priority <= 5 ? 'warning' : 'default'} /></TableCell>
                        <TableCell>{rule.name}</TableCell>
                        <TableCell>{rule.condition}</TableCell>
                        <TableCell>{rule.action}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* 盈亏比保护表 */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>盈亏比保护</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>浮动盈亏区间</TableCell>
                      <TableCell>止损观察线</TableCell>
                      <TableCell>保本线</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.profitProtection.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.floatingProfitRange}</TableCell>
                        <TableCell>{p.stopLossObservation}</TableCell>
                        <TableCell>{p.breakEvenLine}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* 收益矩阵 */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>波段收益矩阵</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>场景</TableCell>
                      <TableCell>价格</TableCell>
                      <TableCell>持仓市值</TableCell>
                      <TableCell>浮动盈亏</TableCell>
                      <TableCell>收益率(%)</TableCell>
                      <TableCell>占总资金(%)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.revenueMatrix.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.scenario}</TableCell>
                        <TableCell>{row.price.toFixed(2)}</TableCell>
                        <TableCell>{row.marketValue.toFixed(2)}</TableCell>
                        <TableCell sx={{ color: row.floatingPnL >= 0 ? 'success.main' : 'error.main' }}>{row.floatingPnL.toFixed(2)}</TableCell>
                        <TableCell sx={{ color: row.returnRate >= 0 ? 'success.main' : 'error.main' }}>{row.returnRate.toFixed(2)}</TableCell>
                        <TableCell>{row.capitalRatio.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* 监控清单 */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>监控清单</Typography>
              {result.monitoringList.map((item, i) => (
                <Typography key={i} variant="body2">• {item}</Typography>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <RiskDisclaimer />
    </Box>
  );
}
