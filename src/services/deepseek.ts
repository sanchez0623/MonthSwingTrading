import type { ScreeningResult } from '../types';

const API_PROXY = '/api/deepseek/chat/completions';
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

export async function runScreening(apiKey: string): Promise<{
  result: ScreeningResult | null;
  rawContent: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SCREENING_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `请基于最新的A股市场数据，执行月度波段选股预筛选。今天是${new Date().toISOString().slice(0, 10)}。`,
          },
        ],
        tools: [
          {
            type: 'web_search',
            web_search: {},
          },
        ],
        tool_choice: 'auto',
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

export async function chatWithDeepSeek(
  apiKey: string,
  messages: { role: string; content: string }[],
  useWebSearch = false
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      model: 'deepseek-chat',
      messages,
    };
    if (useWebSearch) {
      body.tools = [{ type: 'web_search', web_search: {} }];
      body.tool_choice = 'auto';
    }

    const response = await fetch(API_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
