import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getApiKeys,
  getApiKeyStats,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  toggleApiKey,
  queryAllBalances,
  queryBalance,
  resetLoads,
  type ApiKeyItem,
  type ApiKeyStats,
  type BalanceResult,
} from '../api/admin';
import {
  Key,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Wallet,
  Activity,
  AlertCircle,
  Clock,
  Zap,
  TrendingUp,
  Shield,
  Pencil,
  Save,
  X,
} from 'lucide-react';

const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 分钟

export default function AdminPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [balances, setBalances] = useState<Record<number, BalanceResult>>({});
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL / 1000);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 表单状态
  const [formName, setFormName] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formMaxConcurrent, setFormMaxConcurrent] = useState(5);
  const [formPriority, setFormPriority] = useState(0);
  const [formError, setFormError] = useState('');

  // 编辑状态
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editKey, setEditKey] = useState('');
  const [editMaxConcurrent, setEditMaxConcurrent] = useState(5);
  const [editPriority, setEditPriority] = useState(0);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [keysData, statsData] = await Promise.all([getApiKeys(), getApiKeyStats()]);
      setKeys(keysData);
      setStats(statsData);
    } catch (err: any) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBalances = useCallback(async () => {
    try {
      setBalanceLoading(true);
      const { balances: data } = await queryAllBalances();
      setBalances(data);
      setLastRefreshed(new Date());
      setCountdown(AUTO_REFRESH_INTERVAL / 1000);
    } catch (err: any) {
      console.error('批量查询余额失败:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadData().then(() => refreshBalances());
  }, [loadData, refreshBalances]);

  // 10 分钟自动刷新余额
  useEffect(() => {
    timerRef.current = setInterval(() => {
      refreshBalances();
    }, AUTO_REFRESH_INTERVAL);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? AUTO_REFRESH_INTERVAL / 1000 : prev - 1));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [refreshBalances]);

  const handleManualRefreshBalance = async (id: number) => {
    try {
      const result = await queryBalance(id);
      setBalances((prev) => ({
        ...prev,
        [id]: {
          success: true,
          id,
          remainCoins: result.remainCoins,
          currentTaskCounts: result.currentTaskCounts,
          remainMoney: result.remainMoney,
          currency: result.currency,
          apiType: result.apiType,
        },
      }));
    } catch (err: any) {
      setBalances((prev) => ({ ...prev, [id]: { success: false, error: err.message } }));
    }
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formKey.trim()) {
      setFormError('名称和 API Key 不能为空');
      return;
    }
    try {
      setFormError('');
      await addApiKey({
        name: formName.trim(),
        apiKey: formKey.trim(),
        maxConcurrent: formMaxConcurrent,
        priority: formPriority,
      });
      setShowAddForm(false);
      setFormName('');
      setFormKey('');
      setFormMaxConcurrent(5);
      setFormPriority(0);
      await loadData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除 "${name}" 吗？`)) return;
    try {
      await deleteApiKey(id);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleApiKey(id);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetLoads = async () => {
    if (!confirm('确定重置所有 Key 的负载计数吗？')) return;
    try {
      await resetLoads();
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartEdit = (key: ApiKeyItem) => {
    setEditingId(key.id);
    setEditName(key.name);
    setEditKey(''); // API Key 是脱敏的，留空表示不修改
    setEditMaxConcurrent(key.maxConcurrent);
    setEditPriority(key.priority);
    setEditError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) {
      setEditError('名称不能为空');
      return;
    }
    try {
      setEditSaving(true);
      setEditError('');
      const params: any = {
        name: editName.trim(),
        maxConcurrent: editMaxConcurrent,
        priority: editPriority,
      };
      // 只有填写了新 Key 才更新
      if (editKey.trim()) {
        params.apiKey = editKey.trim();
      }
      await updateApiKey(id, params);
      setEditingId(null);
      await loadData();
      // 保存成功后自动拉取余额
      await handleManualRefreshBalance(id);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <RefreshCw className="w-7 h-7 animate-spin text-blue-400" />
        <span className="text-sm text-runway-slate">加载中...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-runway-black">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* 页头 */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
              <h1 className="text-lg font-semibold text-white">API Key 管理</h1>
            </div>
            <p className="text-xs text-runway-slate ml-9">RunningHub 多账号负载均衡池</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetLoads}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-runway-surface border border-runway-border text-runway-slate hover:text-white hover:border-runway-mid-slate rounded-lg transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              重置负载
            </button>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-900/30"
            >
              <Plus className="w-3 h-3" />
              添加 Key
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="总 Key 数"
              value={stats.total}
              icon={<Key className="w-3.5 h-3.5" />}
              color="slate"
            />
            <StatCard
              label="已启用"
              value={stats.enabled}
              icon={<ToggleRight className="w-3.5 h-3.5" />}
              color="green"
              sub={stats.disabled > 0 ? `${stats.disabled} 已禁用` : undefined}
            />
            <StatCard
              label="当前负载"
              value={`${stats.totalLoad} / ${stats.totalCapacity}`}
              icon={<Activity className="w-3.5 h-3.5" />}
              color="yellow"
              sub={`利用率 ${stats.utilization}%`}
            />
            <StatCard
              label="累计调用"
              value={stats.totalUsed.toLocaleString()}
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              color="blue"
            />
          </div>
        )}

        {/* 余额刷新状态栏 */}
        <div className="flex items-center justify-between px-3 py-2 bg-runway-surface border border-runway-border rounded-lg">
          <div className="flex items-center gap-2 text-xs text-runway-slate">
            <Clock className="w-3.5 h-3.5" />
            {lastRefreshed ? (
              <span>上次刷新: {lastRefreshed.toLocaleTimeString('zh-CN')}</span>
            ) : (
              <span>余额未加载</span>
            )}
            <span className="text-runway-border">·</span>
            <span>下次刷新: <span className="text-blue-400 font-mono">{formatCountdown(countdown)}</span></span>
          </div>
          <button
            onClick={refreshBalances}
            disabled={balanceLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-runway-black border border-runway-border text-runway-slate hover:text-white rounded-md transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${balanceLoading ? 'animate-spin' : ''}`} />
            {balanceLoading ? '刷新中...' : '立即刷新'}
          </button>
        </div>

        {/* 添加表单 */}
        {showAddForm && (
          <div className="bg-runway-surface border border-blue-500/30 rounded-xl p-5 space-y-4 shadow-lg shadow-blue-900/10">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full" />
              <h3 className="text-sm font-medium text-white">添加新 API Key</h3>
            </div>
            {formError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-runway-slate">备注名称</label>
                <input
                  type="text"
                  placeholder="如：账号1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-runway-black border border-runway-border rounded-lg text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-runway-slate">API Key</label>
                <input
                  type="text"
                  placeholder="粘贴 API Key"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  className="w-full px-3 py-2 bg-runway-black border border-runway-border rounded-lg text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-runway-slate">并发上限</label>
                <input
                  type="number"
                  placeholder="5"
                  value={formMaxConcurrent}
                  onChange={(e) => setFormMaxConcurrent(parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 bg-runway-black border border-runway-border rounded-lg text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-runway-slate">优先级（越大越优先）</label>
                <input
                  type="number"
                  placeholder="0"
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-runway-black border border-runway-border rounded-lg text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-md shadow-blue-900/30"
              >
                确认添加
              </button>
              <button
                onClick={() => { setShowAddForm(false); setFormError(''); }}
                className="px-4 py-1.5 text-sm bg-runway-black text-runway-slate hover:text-white rounded-lg border border-runway-border transition-all"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Key 列表 */}
        <div className="space-y-2.5">
          {keys.length === 0 ? (
            <div className="text-center py-16 text-runway-slate">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-runway-surface border border-runway-border flex items-center justify-center">
                <Key className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm">暂无 API Key</p>
              <p className="text-xs mt-1 opacity-60">点击右上角「添加 Key」开始</p>
            </div>
          ) : (
            keys.map((key) => {
              const bal = balances[key.id];
              const loadPct = key.maxConcurrent > 0 ? (key.currentLoad / key.maxConcurrent) * 100 : 0;
              return (
                <div
                  key={key.id}
                  className={`group bg-runway-surface border rounded-xl p-4 transition-all hover:border-runway-mid-slate/50 ${
                    key.enabled ? 'border-runway-border' : 'border-runway-border/30 opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* 左侧信息 */}
                    <div className="flex-1 min-w-0 space-y-2.5">
                      {/* 名称行 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{key.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-runway-black border border-runway-border text-runway-mid-slate font-mono tracking-wide">
                          {key.apiKey}
                        </span>
                        {key.enabled ? (
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-green-900/20 border border-green-500/20 text-green-400">启用</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-red-900/20 border border-red-500/20 text-red-400">禁用</span>
                        )}
                        {key.priority > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-yellow-900/20 border border-yellow-500/20 text-yellow-400">
                            优先级 {key.priority}
                          </span>
                        )}
                      </div>

                      {/* 负载进度条 */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-runway-slate">
                          <span>并发负载</span>
                          <span className={loadPct >= 100 ? 'text-red-400' : loadPct >= 70 ? 'text-yellow-400' : 'text-green-400'}>
                            {key.currentLoad} / {key.maxConcurrent}
                          </span>
                        </div>
                        <div className="h-1 bg-runway-black rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              loadPct >= 100 ? 'bg-red-500' : loadPct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(loadPct, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* 余额信息 */}
                      {bal ? (
                        bal.success ? (
                          <div className="flex items-center gap-3 flex-wrap">
                            {bal.remainCoins != null && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/20 border border-blue-500/20 rounded-lg">
                                <Zap className="w-3 h-3 text-blue-400" />
                                <span className="text-xs text-blue-300">算力 <span className="font-medium">{bal.remainCoins}</span></span>
                              </div>
                            )}
                            {bal.remainMoney != null && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-900/20 border border-green-500/20 rounded-lg">
                                <Wallet className="w-3 h-3 text-green-400" />
                                <span className="text-xs text-green-300">
                                  余额 <span className="font-medium">{bal.remainMoney}</span>
                                  {bal.currency && <span className="opacity-70"> {bal.currency}</span>}
                                </span>
                              </div>
                            )}
                            {bal.currentTaskCounts != null && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-900/20 border border-yellow-500/20 rounded-lg">
                                <Activity className="w-3 h-3 text-yellow-400" />
                                <span className="text-xs text-yellow-300">运行中 <span className="font-medium">{bal.currentTaskCounts}</span></span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-red-400/80">
                            <AlertCircle className="w-3 h-3" />
                            <span>查询失败: {bal.error}</span>
                          </div>
                        )
                      ) : (
                        <div className="text-xs text-runway-slate/50">余额加载中...</div>
                      )}

                      {/* 底部元信息 */}
                      <div className="flex items-center gap-3 text-xs text-runway-slate/60">
                        <span>累计 {key.totalUsed.toLocaleString()} 次</span>
                        {key.lastUsedAt && (
                          <span>最近使用 {new Date(key.lastUsedAt).toLocaleString('zh-CN')}</span>
                        )}
                      </div>

                      {key.lastError && (
                        <div className="flex items-center gap-1.5 text-xs text-red-400/70 truncate">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">最近错误: {key.lastError}</span>
                        </div>
                      )}
                    </div>

                    {/* 右侧操作按钮 */}
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(key)}
                        className="p-1.5 rounded-lg text-runway-slate hover:text-emerald-400 hover:bg-emerald-900/20 transition-all"
                        title="编辑"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleManualRefreshBalance(key.id)}
                        className="p-1.5 rounded-lg text-runway-slate hover:text-blue-400 hover:bg-blue-900/20 transition-all"
                        title="刷新余额"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggle(key.id)}
                        className="p-1.5 rounded-lg text-runway-slate hover:text-yellow-400 hover:bg-yellow-900/20 transition-all"
                        title={key.enabled ? '禁用' : '启用'}
                      >
                        {key.enabled
                          ? <ToggleRight className="w-3.5 h-3.5 text-green-400" />
                          : <ToggleLeft className="w-3.5 h-3.5" />
                        }
                      </button>
                      <button
                        onClick={() => handleDelete(key.id, key.name)}
                        className="p-1.5 rounded-lg text-runway-slate hover:text-red-400 hover:bg-red-900/20 transition-all"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 编辑表单 */}
                  {editingId === key.id && (
                    <div className="mt-3 pt-3 border-t border-runway-border space-y-3">
                      {editError && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          {editError}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-runway-slate">备注名称</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 bg-runway-black border border-runway-border rounded-lg text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-runway-slate">API Key <span className="opacity-50">（留空则不修改）</span></label>
                          <input
                            type="text"
                            placeholder="输入新 Key 以替换"
                            value={editKey}
                            onChange={(e) => setEditKey(e.target.value)}
                            className="w-full px-3 py-2 bg-runway-black border border-runway-border rounded-lg text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500 transition-colors font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-runway-slate">并发上限</label>
                          <input
                            type="number"
                            value={editMaxConcurrent}
                            onChange={(e) => setEditMaxConcurrent(parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 bg-runway-black border border-runway-border rounded-lg text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-runway-slate">优先级（越大越优先）</label>
                          <input
                            type="number"
                            value={editPriority}
                            onChange={(e) => setEditPriority(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-runway-black border border-runway-border rounded-lg text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleSaveEdit(key.id)}
                          disabled={editSaving}
                          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-md shadow-blue-900/30 disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {editSaving ? '保存中...' : '保存并刷新余额'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-runway-black text-runway-slate hover:text-white rounded-lg border border-runway-border transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── 统计卡片 ──────────────────────────────────────────────
const colorMap = {
  slate: { bg: 'bg-runway-surface', border: 'border-runway-border', icon: 'text-runway-slate', val: 'text-white' },
  green: { bg: 'bg-green-900/10', border: 'border-green-500/20', icon: 'text-green-400', val: 'text-green-300' },
  yellow: { bg: 'bg-yellow-900/10', border: 'border-yellow-500/20', icon: 'text-yellow-400', val: 'text-yellow-300' },
  blue: { bg: 'bg-blue-900/10', border: 'border-blue-500/20', icon: 'text-blue-400', val: 'text-blue-300' },
};

function StatCard({
  label,
  value,
  icon,
  color = 'slate',
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: keyof typeof colorMap;
  sub?: string;
}) {
  const c = colorMap[color];
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-3.5`}>
      <div className={`flex items-center gap-1.5 text-xs mb-2 ${c.icon}`}>
        {icon}
        <span className="text-runway-slate">{label}</span>
      </div>
      <div className={`text-xl font-bold ${c.val}`}>{value}</div>
      {sub && <div className="text-xs text-runway-slate/60 mt-0.5">{sub}</div>}
    </div>
  );
}
