import type { ScreeningResult, CandidateStock } from '../types';

const TIMEOUT_MS = 60000;

const SCREENING_SYSTEM_PROMPT = `你是一位专业的A股波段交易分析师。请根据以下三步流程执行选股预筛选：

步骤1 - 定位市场主线：
- 观察近5~10个交易日
- 三重验证标准（同时满足才算主线）：
  - 区间涨幅排名前10
  - 区间成交额环比放大≥20%
  - 区间主力净流入排名前10（或净流入额>20亿）
- 热钱收敛验证（排除伪主线）：板块20日涨幅排名前3但最近3日涨幅掉出前5→剔除
- 输出3个最强概念/行业板块及核心驱动逻辑

步骤2 - 从主线板块精选个股：
- 趋势强度：近10日涨幅≥板块同期涨幅+5%，且日线MACD金叉或多头
- 流动性：近5日均成交额>1亿元（主板）/>5000万（创业板/科创板）
- 过滤垃圾股：剔除ST、*ST、立案调查股；剔除20日跌幅超过25%的庄股
- 避开业绩雷：已披露季报不能"净利润亏损且同比恶化>50%"
- 输出每只个股：所属板块、近10日涨幅、MACD状态

步骤3 - 寻找首次回踩支撑买点：
- ①缩量止跌：近1~2日回踩5/10/20日均线，成交额缩至前3日均量70%以下
- ②下影线/十字星止跌：当日收出带明显下影线阳线、十字星或锤子线
- 双重确认→进入候选池（每板块最多3只）

请使用联网搜索获取最新市场数据，然后严格按照以下JSON格式返回结果（不要包含其他文字）：
{
  "mainThemes": [
    {"name": "板块名", "logic": "核心驱动逻辑"}
  ],
  "candidates": [
    {
      "name": "股票名",
      "code": "代码",
      "board": "所属主线",
      "gain10d": "+18.5%",
      "supportLine": "MA5",
      "volumeRatio": 0.65,
      "pattern": "锤子线",
      "highlight": "核心看点"
    }
  ],
  "analysisDate": "2026-05-14",
  "summary": "总结"
}`;

function parseAIResponse(content: string): ScreeningResult | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as ScreeningResult;
  } catch {
    return null;
  }
}

/**
 * 构建请求 URL
 * - 如果 baseUrl 以 /api/llm 开头（相对路径），走 Vite 代理
 * - 否则直接使用用户配置的 baseUrl（直连模式，可能有 CORS 限制）
 */
function buildEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, ''); // 去掉末尾斜杠
  // 相对路径模式 → 走 Vite 代理
  if (base.startsWith('/')) {
    return `${base}/v1/chat/completions`;
  }
  // 绝对路径模式 → 直连
  // 用户可能输入 https://api.deepseek.com 或 https://api.openai.com/v1
  if (base.endsWith('/v1') || base.endsWith('/v1/')) {
    return `${base.replace(/\/+$/, '')}/chat/completions`;
  }
  return `${base}/v1/chat/completions`;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  useWebSearch?: boolean; // DeepSeek 专用联网搜索，其他 API 不支持
}

/** 判断是否为 DeepSeek 官方 API（支持 web_search 工具） */
function isDeepSeekAPI(baseUrl: string): boolean {
  const lower = baseUrl.toLowerCase();
  return lower.includes('deepseek.com') || lower.includes('api.deepseek');
}

export async function runScreening(config: LLMConfig): Promise<{
  result: ScreeningResult | null;
  rawContent: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const endpoint = buildEndpoint(config.baseUrl);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: 'system', content: SCREENING_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `请基于最新的A股市场数据，执行月度波段选股预筛选。今天是${new Date().toISOString().slice(0, 10)}。`,
          },
        ],
        // web_search 仅 DeepSeek 官方 API 支持
        ...(config.useWebSearch !== false && isDeepSeekAPI(config.baseUrl)
          ? {
              tools: [{ type: 'web_search', web_search: {} }],
              tool_choice: 'auto',
            }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const result = parseAIResponse(content);

    return { result, rawContent: content };
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatWithLLM(
  config: LLMConfig,
  messages: { role: string; content: string }[],
  useWebSearch = false
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const endpoint = buildEndpoint(config.baseUrl);

  try {
    const body: Record<string, unknown> = {
      model: config.modelName,
      messages,
    };
    // web_search 仅 DeepSeek 官方 API 且用户启用时才添加
    if (useWebSearch && isDeepSeekAPI(config.baseUrl)) {
      body.tools = [{ type: 'web_search', web_search: {} }];
      body.tool_choice = 'auto';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// AI 驱动评分 — 让 LLM 分析个股并返回结构化五维度数据
// ============================================================

const SCORING_SYSTEM_PROMPT = `你是一位专业的A股量化分析师。请对指定的股票进行五维度分析，并根据最新市场数据给出客观评价。

五维度体系（总分100）：
1. 技术面（35分）：MACD状态、RSI(14)、布林带位置/带宽、均线排列、成交量、K线形态
2. 资金面（20分）：主力大单净流入、5日累计净流入、机构控盘程度
3. 宏观/产业（20分）：中长期产业逻辑(0~15)、短期预期扩散(0~5)、产业链高频加分(0~2)
4. 基本面（15分）：营收同比、归母净利同比、毛利率趋势、经营现金流、盈利稳健性
5. 情绪/估值（10分）：PE(TTM)历史分位、股息率、机构目标价差异、市场情绪位置

请使用联网搜索获取最新数据，然后严格按照以下JSON格式返回（不要包含其他文字）：
{
  "stockName": "股票名",
  "stockCode": "代码",
  "currentPrice": 25.60,
  "board": "主板",
  "technical": {
    "macdStatus": "金叉|死叉|零轴上穿|零轴下穿|红柱放大|红柱缩小|绿柱放大|绿柱缩小",
    "rsiValue": 55,
    "rsiStatus": "超买|超卖|顶背离|底背离|健康|中性",
    "bollingerPosition": "中上轨|中下轨|上轨附近|下轨附近|中轨附近",
    "bollingerBandwidth": "扩张|收窄|正常",
    "maPattern": "多头|空头|粘合|分散",
    "volumePattern": "放量|缩量|量价配合|缩量止跌|放量突破",
    "kLinePattern": "锤子线|空方炮|阳包阴|十字星|大阳线|大阴线|无特殊形态"
  },
  "fund": {
    "mainForceNetInflow": 3500,
    "netInflow5d": 12000,
    "controlLevel": "完全控盘|高度控盘|中度控盘|轻度控盘|无控盘",
    "controlPercent": 32
  },
  "macro": {
    "industryLogicScore": 10,
    "shortTermDiffusionScore": 3,
    "highFrequencyBonus": 1
  },
  "fundamental": {
    "revenueYoY": 15.5,
    "netProfitYoY": 22.3,
    "grossMarginTrend": "上升|持平|下降",
    "operatingCashFlowDirection": "正|负|持平",
    "cashFlowMatch": true,
    "earningStability": "稳健|一般|偏差"
  },
  "emotion": {
    "peTtmPercentile": 35,
    "dividendYield": 2.5,
    "targetPriceDiff": 18,
    "emotionLevel": "极度亢奋|偏亢奋|中性|偏悲观|极度悲观"
  },
  "dataSourceStatus": "官方已正式披露|多平台交叉验证|UGC来源|财报延迟披露",
  "analysisSummary": "简要分析说明"
}`;

export interface AIScoreData {
  stockName: string;
  stockCode: string;
  currentPrice: number;
  board: string;
  technical: {
    macdStatus: string;
    rsiValue: number;
    rsiStatus: string;
    bollingerPosition: string;
    bollingerBandwidth: string;
    maPattern: string;
    volumePattern: string;
    kLinePattern: string;
  };
  fund: {
    mainForceNetInflow: number;
    netInflow5d: number;
    controlLevel: string;
    controlPercent: number;
  };
  macro: {
    industryLogicScore: number;
    shortTermDiffusionScore: number;
    highFrequencyBonus: number;
  };
  fundamental: {
    revenueYoY: number;
    netProfitYoY: number;
    grossMarginTrend: string;
    operatingCashFlowDirection: string;
    cashFlowMatch: boolean;
    earningStability: string;
  };
  emotion: {
    peTtmPercentile: number;
    dividendYield: number;
    targetPriceDiff: number;
    emotionLevel: string;
  };
  dataSourceStatus: string;
  analysisSummary: string;
}

function parseScoreResponse(content: string): AIScoreData | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as AIScoreData;
  } catch {
    return null;
  }
}

export async function aiScoreStock(
  config: LLMConfig,
  stock: CandidateStock
): Promise<{ data: AIScoreData | null; rawContent: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const endpoint = buildEndpoint(config.baseUrl);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: 'system', content: SCORING_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `请分析股票「${stock.name}」（代码：${stock.code}，所属主线：${stock.board}）的最新市场数据，给出五维度评分指标。今天是${new Date().toISOString().slice(0, 10)}。`,
          },
        ],
        ...(config.useWebSearch !== false && isDeepSeekAPI(config.baseUrl)
          ? {
              tools: [{ type: 'web_search', web_search: {} }],
              tool_choice: 'auto',
            }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`评分API请求失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const scoreData = parseScoreResponse(content);

    return { data: scoreData, rawContent: content };
  } finally {
    clearTimeout(timeout);
  }
}
