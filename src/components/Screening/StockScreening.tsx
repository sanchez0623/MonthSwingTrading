import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SaveIcon from '@mui/icons-material/Save';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAppStore } from '../../store/useAppStore';
import { runScreening } from '../../services/deepseek';
import type { CandidateStock, ScreeningResult } from '../../types';

function RiskDisclaimer() {
  return (
    <Alert severity="warning" sx={{ mt: 3, fontSize: '0.8rem' }}>
      风险提示：本系统仅供学习研究使用，不构成投资建议。股市有风险，投资需谨慎。
      AI生成的选股结果基于历史数据和模型推理，不保证未来收益。
    </Alert>
  );
}

export default function StockScreening() {
  const { apiKey, setApiKey, screeningResult, setScreeningResult, candidatePool, setCandidatePool, addToCandidatePool, removeFromCandidatePool, setActiveTab } = useAppStore();
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStock, setManualStock] = useState<Partial<CandidateStock>>({});

  const handleScreening = async () => {
    if (!apiKey.trim()) {
      setError('请先输入并保存 DeepSeek API Key');
      return;
    }
    setLoading(true);
    setError('');
    setRawContent('');
    try {
      const { result, rawContent: raw } = await runScreening(apiKey);
      setRawContent(raw);
      if (result) {
        setScreeningResult(result);
        setCandidatePool(result.candidates);
      } else {
        setError('AI返回的JSON解析失败，请查看原始内容');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const handleAddManual = () => {
    if (manualStock.name && manualStock.code) {
      addToCandidatePool({
        name: manualStock.name,
        code: manualStock.code,
        board: manualStock.board ?? '',
        gain10d: manualStock.gain10d ?? '',
        supportLine: manualStock.supportLine ?? '',
        volumeRatio: manualStock.volumeRatio ?? 0,
        pattern: manualStock.pattern ?? '',
        highlight: manualStock.highlight ?? '',
      });
      setManualStock({});
      setManualOpen(false);
    }
  };

  const handleImportToScoring = () => {
    setActiveTab('scoring');
  };

  return (
    <Box>
      {/* API Key 输入 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            DeepSeek API Key
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowKey(!showKey)}>
                        {showKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Tooltip title="保存Key">
              <Button variant="outlined" size="small" startIcon={<SaveIcon />} onClick={() => setApiKey(apiKey)}>
                保存
              </Button>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* 一键选股 */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          {loading ? (
            <Box>
              <CircularProgress size={48} sx={{ mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                AI正在分析市场数据，请稍候...
              </Typography>
            </Box>
          ) : (
            <Button
              variant="contained"
              size="large"
              startIcon={<RocketLaunchIcon />}
              onClick={handleScreening}
              sx={{ px: 6, py: 1.5, fontSize: '1.1rem' }}
            >
              一键AI选股
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 选股结果 */}
      {screeningResult && (
        <>
          {/* 主线板块 */}
          <Typography variant="h6" gutterBottom>
            主线板块
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            {screeningResult.mainThemes.map((theme, idx) => (
              <Card key={idx} sx={{ flex: '1 1 250px', minWidth: 250 }}>
                <CardContent>
                  <Chip label={`TOP${idx + 1}`} color="primary" size="small" sx={{ mb: 1 }} />
                  <Typography variant="h6">{theme.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {theme.logic}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* 候选股票表格 */}
          <Typography variant="h6" gutterBottom>
            候选股票池
          </Typography>
          <TableContainer component={Card} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>股票名</TableCell>
                  <TableCell>代码</TableCell>
                  <TableCell>所属主线</TableCell>
                  <TableCell>近10日涨幅</TableCell>
                  <TableCell>支撑线</TableCell>
                  <TableCell>缩量比</TableCell>
                  <TableCell>K线形态</TableCell>
                  <TableCell>核心看点</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {candidatePool.map((stock) => (
                  <TableRow key={stock.code}>
                    <TableCell>{stock.name}</TableCell>
                    <TableCell>{stock.code}</TableCell>
                    <TableCell>{stock.board}</TableCell>
                    <TableCell>
                      <Chip
                        label={stock.gain10d}
                        size="small"
                        color={stock.gain10d.startsWith('+') ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>{stock.supportLine}</TableCell>
                    <TableCell>{stock.volumeRatio.toFixed(2)}</TableCell>
                    <TableCell>{stock.pattern}</TableCell>
                    <TableCell>{stock.highlight}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => removeFromCandidatePool(stock.code)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 分析日期 & 摘要 */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                分析日期：{screeningResult.analysisDate}
              </Typography>
              <Typography variant="body2">{screeningResult.summary}</Typography>
            </CardContent>
          </Card>

          {/* 原始内容（折叠） */}
          {rawContent && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  AI原始输出
                </Typography>
                <Box
                  sx={{
                    maxHeight: 200,
                    overflow: 'auto',
                    bgcolor: 'action.hover',
                    p: 1,
                    borderRadius: 1,
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                  }}
                >
                  {rawContent}
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 底部操作 */}
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setManualOpen(true)}
        >
          手动添加候选
        </Button>
        {candidatePool.length > 0 && (
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={handleImportToScoring}
          >
            导入到打分模块
          </Button>
        )}
      </Box>

      {/* 手动添加对话框 */}
      <Dialog open={manualOpen} onClose={() => setManualOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>手动添加候选股票</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="股票名称" size="small" value={manualStock.name ?? ''} onChange={(e) => setManualStock({ ...manualStock, name: e.target.value })} />
            <TextField label="股票代码" size="small" value={manualStock.code ?? ''} onChange={(e) => setManualStock({ ...manualStock, code: e.target.value })} />
            <TextField label="所属主线" size="small" value={manualStock.board ?? ''} onChange={(e) => setManualStock({ ...manualStock, board: e.target.value })} />
            <TextField label="近10日涨幅" size="small" value={manualStock.gain10d ?? ''} onChange={(e) => setManualStock({ ...manualStock, gain10d: e.target.value })} />
            <TextField label="支撑线" size="small" value={manualStock.supportLine ?? ''} onChange={(e) => setManualStock({ ...manualStock, supportLine: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleAddManual}>添加</Button>
        </DialogActions>
      </Dialog>

      <RiskDisclaimer />
    </Box>
  );
}
