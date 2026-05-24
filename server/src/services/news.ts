/**
 * AI 新闻热点服务
 * 从国内可直接访问的 RSS 源获取 AI 领域新闻
 * 内存缓存 10 分钟自动刷新
 *
 * 已验证可用数据源：
 * - 36氪 RSS (https://36kr.com/feed)
 * - 36氪快讯 (https://36kr.com/feed-newsflash)
 * - IT之家 RSS (https://www.ithome.com/rss/)
 */

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  link: string;
  pubDate: string;
  timeAgo: string;
}

interface NewsCache {
  data: NewsItem[];
  lastFetch: number;
}

// 缓存配置：10分钟过期
const CACHE_TTL = 10 * 60 * 1000;
let cache: NewsCache = { data: [], lastFetch: 0 };

// 已验证可用的国内 RSS 源
const RSS_FEEDS = [
  { url: 'https://36kr.com/feed', source: '36氪' },
  { url: 'https://36kr.com/feed-newsflash', source: '36氪快讯' },
  { url: 'https://www.ithome.com/rss/', source: 'IT之家' },
];

// AI 相关关键词（用于从综合科技新闻中过滤 AI 内容）
const AI_KEYWORDS = [
  'AI', 'ai', '人工智能', '大模型', 'LLM', 'GPT', 'Claude', 'Gemini',
  '机器学习', '深度学习', 'AIGC', '生成式', 'Sora', 'ChatGPT',
  '智能体', 'AGI', '神经网络', 'Transformer', '多模态', 'Agent',
  '算力', 'GPU', 'NVIDIA', '英伟达',
  'OpenAI', 'DeepSeek', '通义', '文心', '豆包', 'Kimi', 'Midjourney',
  '语言模型', '扩散模型', 'Diffusion', 'Stable Diffusion',
  'RAG', '向量数据库', 'embedding', '微调',
  'Copilot', 'Cursor', '智谱', '百川', '月之暗面',
  '具身智能', '自动驾驶', '机器人', 'robot',
  'Anthropic', 'Meta AI', 'Llama', 'Mistral',
];

function isAIRelated(title: string, summary: string): boolean {
  const text = title + ' ' + summary;
  return AI_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * 解析 RSS XML
 */
function parseRSSItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    if (!title) continue;

    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');

    items.push({
      id: generateId(title + pubDate),
      title: cleanHtml(title),
      summary: cleanHtml(description || '').slice(0, 150),
      source,
      link: link || '',
      pubDate: pubDate || new Date().toISOString(),
      timeAgo: calcTimeAgo(pubDate),
    });
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  // CDATA 格式
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // 普通格式
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function generateId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calcTimeAgo(dateStr: string | undefined): string {
  if (!dateStr) return '刚刚';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '刚刚';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return date.toLocaleDateString('zh-CN');
}

/**
 * 从单个 RSS 源获取数据
 */
async function fetchFeed(feedUrl: string, source: string): Promise<NewsItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[News] ${source} 返回 ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const items = parseRSSItems(xml, source);
    console.log(`[News] ${source} 获取 ${items.length} 条`);
    return items;
  } catch (error: any) {
    console.warn(`[News] ${source} 获取失败: ${error.message}`);
    return [];
  }
}

/**
 * 去重并按时间排序
 */
function deduplicateAndSort(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const unique: NewsItem[] = [];

  for (const item of items) {
    const key = item.title.slice(0, 20);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  unique.sort((a, b) => {
    const dateA = new Date(a.pubDate).getTime() || 0;
    const dateB = new Date(b.pubDate).getTime() || 0;
    return dateB - dateA;
  });

  return unique.slice(0, 20);
}

/**
 * 获取 AI 新闻（带缓存）
 */
export async function getAINews(): Promise<NewsItem[]> {
  const now = Date.now();

  // 缓存未过期，直接返回
  if (cache.data.length > 0 && now - cache.lastFetch < CACHE_TTL) {
    return cache.data;
  }

  console.log('[News] 开始刷新 AI 新闻...');

  // 并行获取所有 RSS 源
  const results = await Promise.allSettled(
    RSS_FEEDS.map((feed) => fetchFeed(feed.url, feed.source))
  );

  const allItems: NewsItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  // 过滤出 AI 相关新闻
  const aiNews = allItems.filter((item) => isAIRelated(item.title, item.summary));

  console.log(`[News] 总计 ${allItems.length} 条，AI 相关 ${aiNews.length} 条`);

  if (aiNews.length > 0) {
    cache = { data: deduplicateAndSort(aiNews), lastFetch: now };
  } else if (allItems.length > 0) {
    // 如果没有匹配到 AI 关键词，返回最新的科技新闻
    console.log('[News] AI 关键词未匹配，返回最新科技新闻');
    cache = { data: deduplicateAndSort(allItems), lastFetch: now };
  } else if (cache.data.length > 0) {
    console.warn('[News] 所有源获取失败，使用旧缓存');
  }

  return cache.data;
}

/**
 * 手动清除缓存（下次请求会重新获取）
 */
export function invalidateNewsCache() {
  cache.lastFetch = 0;
}
