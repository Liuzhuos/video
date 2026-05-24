import { authFetch } from './request';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  link: string;
  pubDate: string;
  timeAgo: string;
}

/**
 * 获取 AI 新闻热点
 */
export async function fetchAINews(): Promise<NewsItem[]> {
  const res = await authFetch('/api/news');
  const json = await res.json();
  if (json.success) {
    return json.data;
  }
  throw new Error(json.message || '获取新闻失败');
}
