import { Flame, TrendingUp, Newspaper, ExternalLink } from 'lucide-react';

// 模拟AI热点新闻数据
const hotNews = [
  {
    id: 1,
    title: 'OpenAI 发布 GPT-5，多模态能力大幅提升',
    summary: '新模型在推理、代码生成和视觉理解方面取得突破性进展，支持更长上下文窗口。',
    source: 'AI Daily',
    time: '2小时前',
    hot: true,
  },
  {
    id: 2,
    title: 'Sora 开放 API，视频生成进入新时代',
    summary: '开发者现在可以通过 API 调用 Sora 模型，生成高质量视频内容。',
    source: 'TechCrunch',
    time: '4小时前',
    hot: true,
  },
  {
    id: 3,
    title: 'Google DeepMind 推出新一代蛋白质结构预测模型',
    summary: 'AlphaFold 3 能够预测几乎所有生物分子的结构，加速药物研发。',
    source: 'Nature',
    time: '6小时前',
    hot: false,
  },
  {
    id: 4,
    title: '国内大模型竞争白热化，多家厂商发布新版本',
    summary: '百度、阿里、字节等公司相继更新旗下大模型，性能对标国际顶尖水平。',
    source: '36氪',
    time: '8小时前',
    hot: false,
  },
  {
    id: 5,
    title: 'Stable Diffusion 4.0 发布，图像生成质量再创新高',
    summary: '新版本在人物一致性、文字渲染和细节表现方面有显著提升。',
    source: 'Stability AI',
    time: '12小时前',
    hot: false,
  },
  {
    id: 6,
    title: 'AI 编程助手市场报告：开发者采用率突破 70%',
    summary: '调查显示超过七成开发者在日常工作中使用 AI 编程工具，效率提升明显。',
    source: 'GitHub Blog',
    time: '1天前',
    hot: false,
  },
];

const trendingTopics = [
  { name: 'AI Agent', heat: 9823 },
  { name: '多模态大模型', heat: 8456 },
  { name: 'AI 视频生成', heat: 7234 },
  { name: 'RAG 技术', heat: 6102 },
  { name: 'AI 编程', heat: 5890 },
];

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white mb-2">AI 热点</h2>
        <p className="text-runway-slate text-sm">关注 AI 领域最新动态与趋势</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：新闻列表 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper className="w-4 h-4 text-runway-slate" />
            <span className="text-sm font-medium text-runway-slate">最新资讯</span>
          </div>

          {hotNews.map((news) => (
            <article
              key={news.id}
              className="bg-runway-surface border border-runway-border rounded-lg p-5 hover:border-runway-charcoal transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {news.hot && (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">
                        <Flame className="w-3 h-3" />
                        热门
                      </span>
                    )}
                    <span className="text-xs text-runway-mid-slate">{news.source}</span>
                    <span className="text-xs text-runway-mid-slate">·</span>
                    <span className="text-xs text-runway-mid-slate">{news.time}</span>
                  </div>
                  <h3 className="text-white font-medium mb-2 group-hover:text-blue-400 transition-colors">
                    {news.title}
                  </h3>
                  <p className="text-sm text-runway-slate leading-relaxed">{news.summary}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-runway-mid-slate opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
              </div>
            </article>
          ))}
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
