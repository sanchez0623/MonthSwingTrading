import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningIcon from '@mui/icons-material/Warning';
import EventIcon from '@mui/icons-material/Event';
import {
  getCurrentTimeSlot,
  CLOCK_TASKS,
  MONTHLY_NODES,
  DAILY_CONSULTATIONS,
  FORBIDDEN_OPERATIONS,
  checkForbiddenOperations,
} from '../../engines/clockEngine';
import type { TimeSlot } from '../../types';

function RiskDisclaimer() {
  return (
    <Alert severity="warning" sx={{ mt: 3, fontSize: '0.8rem' }}>
      风险提示：策略时钟为辅助工具，不构成投资建议。请严格遵守交易纪律，切勿盘中临时更改计划。
    </Alert>
  );
}

export default function StrategyClock() {
  const [currentSlot, setCurrentSlot] = useState<TimeSlot>(getCurrentTimeSlot());
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlot(getCurrentTimeSlot());
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const forbiddenNow = checkForbiddenOperations();

  const slotColor = (slot: TimeSlot): 'success' | 'default' => {
    if (slot === currentSlot) return 'success';
    return 'default';
  };

  return (
    <Box>
      {/* 当前时段 */}
      <Card sx={{ mb: 3, borderLeft: '4px solid #4fc3f7' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <ScheduleIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  当前时段：
                </Typography>
                <Chip label={currentSlot} color="primary" size="medium" />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {currentTime.toLocaleString('zh-CN', { hour12: false })}
              </Typography>
            </Box>
          </Box>
          {forbiddenNow.length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              当前时段禁止操作：{forbiddenNow.map((f) => f.description).join('；')}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 策略时钟全景图 */}
      <Typography variant="h6" gutterBottom>策略时钟全景图</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {CLOCK_TASKS.map((task) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={task.slot}>
            <Card
              sx={{
                height: '100%',
                borderLeft: currentSlot === task.slot ? '4px solid #66bb6a' : undefined,
                bgcolor: currentSlot === task.slot ? 'action.hover' : undefined,
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip label={task.slot} color={slotColor(task.slot)} size="small" />
                  <Typography variant="caption" color="text.secondary">{task.timeRange}</Typography>
                </Box>

                <Typography variant="subtitle2" color="success.main" gutterBottom>黄金任务</Typography>
                <List dense disablePadding>
                  {task.goldenTasks.map((gt, i) => (
                    <ListItem key={i} disablePadding sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}><CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} /></ListItemIcon>
                      <ListItemText primary={gt} />
                    </ListItem>
                  ))}
                </List>

                {task.junkOperations.length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle2" color="error.main" gutterBottom>垃圾操作</Typography>
                    <List dense disablePadding>
                      {task.junkOperations.map((jo, i) => (
                        <ListItem key={i} disablePadding sx={{ py: 0 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}><CancelIcon sx={{ fontSize: 16, color: 'error.main' }} /></ListItemIcon>
                          <ListItemText primary={jo} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 月度关键节点 */}
      <Typography variant="h6" gutterBottom>月度关键节点</Typography>
      <TableContainer component={Card} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>节点</TableCell>
              <TableCell>时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {MONTHLY_NODES.map((node, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Chip icon={<EventIcon />} label={node.name} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  {node.dayOfMonth === 'last-week' ? '最后一周' : node.dayOfMonth === 0 ? '财报窗口期' : `第${node.dayOfMonth}个交易日`}
                </TableCell>
                <TableCell>{node.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 每日咨询节奏 */}
      <Typography variant="h6" gutterBottom>每日咨询节奏（三次对话）</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {DAILY_CONSULTATIONS.map((dc, i) => (
          <Grid size={{ xs: 12, sm: 4 }} key={i}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{dc.name}</Typography>
                <Typography variant="caption" color="text.secondary">{dc.timeRange}</Typography>
                <List dense disablePadding sx={{ mt: 1 }}>
                  {dc.tasks.map((task, j) => (
                    <ListItem key={j} disablePadding sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}><CheckCircleIcon sx={{ fontSize: 14, color: 'info.main' }} /></ListItemIcon>
                      <ListItemText primary={task} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 禁止操作清单 */}
      <Typography variant="h6" gutterBottom>禁止操作清单</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {FORBIDDEN_OPERATIONS.map((fo, i) => (
          <Grid size={{ xs: 12, sm: 6 }} key={i}>
            <Card sx={{ bgcolor: 'error.dark', height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <WarningIcon sx={{ color: '#fff' }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#fff' }}>{fo.description}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>{fo.reason}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <RiskDisclaimer />
    </Box>
  );
}
