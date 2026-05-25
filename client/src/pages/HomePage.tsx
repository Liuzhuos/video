import { useEffect, useState } from 'react';
import { Flame, TrendingUp, Newspaper, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { fetchAINews, type NewsItem } from '../api/news';

// 热门话题（静态展示，后续可接入动态数据）
const trendingTopics = [
  { name: 'AI Agent', heat: 9823 },
  { name: '多模态大模型', heat: 8456 },
  { name: 'AI 视频生成', heat: 7234 },
  { name: 'RAG 技术', heat: 6102 },
  { name: 'AI 编程', heat: 5890 },
];

export default function HomePage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadNews = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchAINews();
      setNews(data);
      setLastUpdate(new Date());
    } catch (err: any) {
      setError(err.message || '获取新闻失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();

    // 每10分钟自动刷新
    const interval = setInterval(loadNews, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* 页面标题 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white mb-2">AI 热点</h2>
          <p className="text-runway-slate text-sm">关注 AI 领域最新动态与趋势</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-runway-mid-slate">
              更新于 {lastUpdate.toLocaleTimeString('zh-CN')}
            </span>
          )}
          <button
            onClick={loadNews}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-runway-slate hover:text-white bg-runway-surface border border-runway-border rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：新闻列表 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper className="w-4 h-4 text-runway-slate" />
            <span className="text-sm font-medium text-runway-slate">最新资讯</span>
          </div>

          {loading && news.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-runway-slate animate-spin" />
              <span className="ml-2 text-runway-slate text-sm">加载中...</span>
            </div>
          ) : error && news.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-runway-slate text-sm mb-3">{error}</p>
              <button
                onClick={loadNews}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                点击重试
              </button>
            </div>
          ) : (
            news.map((item, index) => (
              <article
                key={item.id}
                className="bg-runway-surface border border-runway-border rounded-lg p-5 hover:border-runway-charcoal transition-colors cursor-pointer group"
                onClick={() => item.link && window.open(item.link, '_blank')}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {index < 3 && (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">
                          <Flame className="w-3 h-3" />
                          热门
                        </span>
                      )}
                      <span className="text-xs text-runway-mid-slate">{item.source}</span>
                      <span className="text-xs text-runway-mid-slate">·</span>
                      <span className="text-xs text-runway-mid-slate">{item.timeAgo}</span>
                    </div>
                    <h3 className="text-white font-medium mb-2 group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </h3>
                    {item.summary && (
                      <p className="text-sm text-runway-slate leading-relaxed">{item.summary}</p>
                    )}
                  </div>
                  <ExternalLink className="w-4 h-4 text-runway-mid-slate opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                </div>
              </article>
            ))
          )}
        </div>

        {/* 右侧：热门话题 */}
        <div>
          <div className="bg-runway-surface border border-runway-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-runway-slate" />
              <span className="text-sm font-medium text-runway-slate">热门话题</span>
            </div>

            <div className="space-y-3">
              {trendingTopics.map((topic, index) => (
                <div
                  key={topic.name}
                  className="flex items-center gap-3 py-2 cursor-pointer hover:bg-runway-border/30 rounded px-2 -mx-2 transition-colors"
                >
                  <span
                    className={`text-sm font-bold w-5 text-center ${
                      index < 3 ? 'text-orange-400' : 'text-runway-mid-slate'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm text-white flex-1">{topic.name}</span>
                  <span className="text-xs text-runway-mid-slate">{topic.heat.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
