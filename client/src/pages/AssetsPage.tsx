import { useState, useEffect, useRef } from 'react';
import { Image, Film, Trash2, Download, Loader2, X } from 'lucide-react';
import { authFetch } from '../api/request';

interface MediaItem {
  id: number;
  type: 'IMAGE' | 'VIDEO';
  filename: string;
  url: string;
  size: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  prompt: string | null;
  createdAt: string;
}

type TabType = 'IMAGE' | 'VIDEO';

interface TabData {
  items: MediaItem[];
  total: number;
  totalPages: number;
  page: number;
  loaded: boolean;
}

// 阿里云 OSS 图片处理：生成缩略图 URL
function getThumbnailUrl(url: string, width = 400): string {
  if (!url || !url.includes('aliyuncs.com')) return url;
  return `${url}?x-oss-process=image/resize,w_${width}/quality,q_80/format,webp`;
}

// 视频封面：取第一帧作为封面
function getVideoCoverUrl(url: string, width = 480): string {
  if (!url || !url.includes('aliyuncs.com')) return url;
  return `${url}?x-oss-process=video/snapshot,t_1000,w_${width},f_webp`;
}

const emptyTabData: TabData = { items: [], total: 0, totalPages: 1, page: 1, loaded: false };

export default function AssetsPage() {
  const [tab, setTab] = useState<TabType>('IMAGE');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const pageSize = 12;

  // 分别缓存图片和视频的数据
  const cacheRef = useRef<Record<TabType, Record<number, TabData>>>({
    IMAGE: {},
    VIDEO: {},
  });

  const [currentData, setCurrentData] = useState<TabData>(emptyTabData);

  const fetchAssets = async (type: TabType, p: number, forceRefresh = false) => {
    // 如果缓存中已有该页数据且不强制刷新，直接使用
    const cached = cacheRef.current[type][p];
    if (cached && cached.loaded && !forceRefresh) {
      setCurrentData(cached);
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch(`/api/media?type=${type}&page=${p}&pageSize=${pageSize}`);
      if (res.ok) {
        const data = await res.json();
        const tabData: TabData = {
          items: data.items,
          total: data.total,
          totalPages: data.totalPages,
          page: p,
          loaded: true,
        };
        // 存入缓存
        cacheRef.current[type][p] = tabData;
        setCurrentData(tabData);
      }
    } catch (err) {
      console.error('获取资源失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets(tab, currentData.page);
  }, []);

  const handleTabChange = (newTab: TabType) => {
    setTab(newTab);
    // 切换 tab 时，尝试从缓存读取第1页（或上次浏览的页码）
    const cachedPages = cacheRef.current[newTab];
    const lastPage = Object.keys(cachedPages).length > 0
      ? Math.max(...Object.keys(cachedPages).map(Number))
      : 1;
    const cached = cachedPages[1] || cachedPages[lastPage];
    if (cached && cached.loaded) {
      setCurrentData(cached);
    } else {
      fetchAssets(newTab, 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentData((prev) => ({ ...prev, page: newPage }));
    fetchAssets(tab, newPage);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个资源吗？')) return;
    try {
      const res = await authFetch(`/api/media/${id}`, { method: 'DELETE' });
      if (res.ok) {
        // 删除后清除当前 tab 的缓存并重新加载当前页
        cacheRef.current[tab] = {};
        fetchAssets(tab, currentData.page, true);
      }
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const { items, total, totalPages, page } = currentData;

  return (
    <div className="h-full overflow-y-auto bg-runway-black">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">个人资产</h1>
          <p className="text-sm text-runway-slate mt-1">管理你生成的所有图像和视频内容</p>
        </div>

        {/* Tab 切换 */}
        <div className="flex items-center gap-1 mb-6 bg-runway-surface/50 rounded-lg p-1 w-fit">
          <button
            onClick={() => handleTabChange('IMAGE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'IMAGE'
                ? 'bg-runway-surface text-white shadow-sm'
                : 'text-runway-slate hover:text-white'
            }`}
          >
            <Image className="w-4 h-4" />
            图像
          </button>
          <button
            onClick={() => handleTabChange('VIDEO')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'VIDEO'
                ? 'bg-runway-surface text-white shadow-sm'
                : 'text-runway-slate hover:text-white'
            }`}
          >
            <Film className="w-4 h-4" />
            视频
          </button>
        </div>

        {/* 统计 */}
        <div className="text-xs text-runway-slate mb-4">
          共 {total} 个{tab === 'IMAGE' ? '图像' : '视频'}
        </div>

        {/* 内容区域 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-runway-slate animate-spin" />
            <span className="ml-2 text-runway-slate text-sm">加载中...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-runway-slate">
            {tab === 'IMAGE' ? (
              <Image className="w-12 h-12 mb-3 opacity-50" />
            ) : (
              <Film className="w-12 h-12 mb-3 opacity-50" />
            )}
            <p className="text-sm">暂无{tab === 'IMAGE' ? '图像' : '视频'}资源</p>
            <p className="text-xs mt-1 opacity-70">使用应用生成内容后会自动保存到这里</p>
          </div>
        ) : (
          <>
            {/* 网格展示 */}
            <div className={`grid gap-4 ${
              tab === 'IMAGE'
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group bg-runway-surface border border-runway-border rounded-lg overflow-hidden hover:border-runway-slate/50 transition-colors"
                >
                  {/* 预览 */}
                  <div className="relative aspect-video bg-black/50 cursor-pointer" onClick={() => setPreview(item)}>
                    {item.type === 'IMAGE' ? (
                      <img
                        src={getThumbnailUrl(item.url)}
                        alt={item.prompt || item.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <>
                        <img
                          src={getVideoCoverUrl(item.url)}
                          alt={item.prompt || item.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-white ml-0.5" />
                          </div>
                        </div>
                      </>
                    )}

                    {/* 悬浮操作 */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                        title="下载"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 视频时长标签 */}
                    {item.type === 'VIDEO' && item.duration && (
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[10px] bg-black/70 text-white rounded">
                        {item.duration.toFixed(1)}s
                      </span>
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="p-3">
                    {item.prompt && (
                      <p className="text-xs text-runway-slate line-clamp-2 mb-1.5" title={item.prompt}>
                        {item.prompt}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-runway-mid-slate">
                      <span>{formatDate(item.createdAt)}</span>
                      <span>{formatSize(item.size)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm rounded-md bg-runway-surface text-runway-slate hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  上一页
                </button>
                <span className="text-sm text-runway-slate">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm rounded-md bg-runway-surface text-runway-slate hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 预览弹窗 */}
      {preview && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            {preview.type === 'IMAGE' ? (
              <img
                src={preview.url}
                alt={preview.prompt || preview.filename}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={preview.url}
                className="w-full max-h-[80vh] rounded-lg"
                controls
                autoPlay
              />
            )}
            {preview.prompt && (
              <p className="mt-3 text-sm text-runway-slate text-center">{preview.prompt}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
