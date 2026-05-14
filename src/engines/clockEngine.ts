// ============================================================
// 时钟引擎 — 时段任务 + 月度节点 + 禁操校验
// ============================================================

import type { TimeSlot, ClockTask, MonthlyNode, DailyConsultation, ForbiddenOperation } from '../types';

// ---------- 时段判断 ----------

export function getCurrentTimeSlot(now: Date = new Date()): TimeSlot {
  const h = now.getHours();
  const m = now.getMinutes();
  const t = h * 60 + m; // minutes since midnight

  if (t < 9 * 60 + 15) return '盘前';        // 8:00 - 9:15
  if (t < 11 * 60) return '上午';              // 9:30 - 11:00
  if (t < 11 * 60 + 30) return '上午收盘';     // 11:00 - 11:30
  if (t < 14 * 60 + 30) return '下午';         // 13:00 - 14:30
  return '收盘后';                              // 15:30+
}

// ---------- 策略时钟全景图 ----------

export const CLOCK_TASKS: ClockTask[] = [
  {
    timeRange: '8:00 - 9:15',
    slot: '盘前',
    goldenTasks: [
      '收集隔夜消息（外围市场、政策、产业动态）',
      '穷举开盘路径（高开/低开各4档及应对）',
      '生成执行清单（买/卖/观/不操作）',
    ],
    junkOperations: ['竞价挂单', '看到利多就想冲'],
  },
  {
    timeRange: '9:30 - 11:00',
    slot: '上午',
    goldenTasks: [
      '执行盘前预案确认信号',
      '10:00-11:00是最清醒建仓窗口',
      '按首仓开盘应对规则分笔建仓',
    ],
    junkOperations: ['开盘5分钟追单', 'MACD刚翻红就加满'],
  },
  {
    timeRange: '11:00 - 11:30',
    slot: '上午收盘',
    goldenTasks: [
      '持仓诊断：是否触发减仓条件？',
      '浮盈/浮亏评估',
      '下午操作预案',
    ],
    junkOperations: [],
  },
  {
    timeRange: '13:00 - 14:30',
    slot: '下午',
    goldenTasks: [
      '执行午间诊断后的减仓/清仓操作',
      '根据上午走势调整下午策略',
    ],
    junkOperations: ['14:55后开新仓或重仓加仓'],
  },
  {
    timeRange: '15:30+',
    slot: '收盘后',
    goldenTasks: [
      '生成次日完整策略：复盘+止盈止损更新+路径穷举',
      '更新评分（如有新数据）',
      '记录交易日志',
    ],
    junkOperations: ['盘中临时改规则'],
  },
];

// ---------- 月度关键节点 ----------

export const MONTHLY_NODES: MonthlyNode[] = [
  {
    name: '月初扫描',
    description: '每月第1个交易日：用选股系统扫描候选池',
    dayOfMonth: 1,
  },
  {
    name: '月中检查',
    description: '每月第15个交易日左右：时间止损检查',
    dayOfMonth: 15,
  },
  {
    name: '月末退出',
    description: '每月最后一周：不再开新仓，只做退出',
    dayOfMonth: 'last-week',
  },
  {
    name: '财报窗口',
    description: '财报披露窗口期：提前3天降至半仓',
    dayOfMonth: 0,
  },
];

// ---------- 每日咨询节奏 ----------

export const DAILY_CONSULTATIONS: DailyConsultation[] = [
  {
    timeRange: '8:30 - 9:00',
    name: '盘前推演',
    tasks: [
      '推演开盘路径',
      '生成行动清单',
      '确认首仓开盘应对方案',
    ],
  },
  {
    timeRange: '11:30 - 12:00',
    name: '午间诊断',
    tasks: [
      '持仓诊断',
      '下午操作预案',
      '是否触发减仓/清仓条件',
    ],
  },
  {
    timeRange: '16:00+',
    name: '收盘复盘',
    tasks: [
      '复盘当日操作',
      '次日预案',
      '止盈止损更新',
      '交易日志',
    ],
  },
];

// ---------- 禁止操作清单 ----------

export const FORBIDDEN_OPERATIONS: ForbiddenOperation[] = [
  {
    description: '盘中临时修改止盈止损参数',
    reason: '盘中情绪波动大，参数修改容易导致非理性决策',
  },
  {
    description: '尾盘14:55后开新仓或重仓加仓',
    reason: '尾盘流动性差，且无法观察次日开盘反应',
  },
  {
    description: '盘中看到新闻标题就立刻操作',
    reason: '新闻传播有延迟，股价可能已反映，追入容易被套',
  },
  {
    description: '财报日重仓隔夜',
    reason: '财报不确定性大，重仓隔夜风险不可控',
  },
];

// ---------- 禁操校验 ----------

export function checkForbiddenOperations(): ForbiddenOperation[] {
  const slot = getCurrentTimeSlot();
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  const triggered: ForbiddenOperation[] = [];

  // 尾盘14:55后开新仓
  if (slot === '下午' && h * 60 + m >= 14 * 60 + 55) {
    triggered.push(FORBIDDEN_OPERATIONS[1]);
  }

  return triggered;
}

// ---------- 判断是否为交易日 ----------

export function isTradingDay(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 简单判断：非周末
}

// ---------- 获取月度第N个交易日（简化版） ----------

export function getNthTradingDayOfMonth(year: number, month: number, n: number): Date | null {
  // 简化实现：忽略节假日，仅排除周末
  const date = new Date(year, month - 1, 1);
  let count = 0;

  while (date.getMonth() === month - 1) {
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      count++;
      if (count === n) return new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }

  return null;
}

// ---------- 获取当月最后一周交易日 ----------

export function getLastWeekTradingDays(year: number, month: number): Date[] {
  const lastDay = new Date(year, month, 0); // last day of month
  const days: Date[] = [];
  const date = new Date(lastDay);

  // Go back up to 7 days to find the last week
  for (let i = 0; i < 7; i++) {
    if (date.getMonth() !== month - 1) break;
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      days.push(new Date(date));
    }
    date.setDate(date.getDate() - 1);
  }

  return days.reverse();
}
