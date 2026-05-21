import { useState, useEffect, useCallback } from 'react';
import {
  getApiKeys,
  getApiKeyStats,
  addApiKey,
  deleteApiKey,
  toggleApiKey,
  queryBalance,
  resetLoads,
  type ApiKeyItem,
  type ApiKeyStats,
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
} from 'lucide-react';

export default function AdminPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [balances, setBalances] = useState<Record<number, string>>({});
  const [balanceLoading, setBalanceLoading] = useState<Record<number, boolean>>({});

  // 表单状态
  const [formName, setFormName] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formMaxConcurrent, setFormMaxConcurrent] = useState(5);
  const [formPriority, setFormPriority] = useState(0);
  const [formError, setFormError] = useState('');

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

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleQueryBalance = async (id: number) => {
    try {
      setBalanceLoading((prev) => ({ ...prev, [id]: true }));
      const result = await queryBalance(id);
      const balanceText = typeof result.balance === 'object'
        ? JSON.stringify(result.balance)
        : String(result.balance);
      setBalances((prev) => ({ ...prev, [id]: balanceText }));
    } catch (err: any) {
      setBalances((prev) => ({ ...prev, [id]: `错误: ${err.message}` }));
    } finally {
      setBalanceLoading((prev) => ({ ...prev, [id]: false }));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 animate-spin text-runway-slate" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">API Key 管理</h1>
          <p className="text-sm text-runway-slate mt-1">管理 RunningHub API Key 池，实现多账号负载均衡</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleResetLoads}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-runway-surface text-runway-slate hover:text-white rounded-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重置负载
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加 Key
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="总 Key 数" value={stats.total} icon={<Key className="w-4 h-4" />} />
          <StatCard label="已启用" value={stats.enabled} icon={<ToggleRight className="w-4 h-4 text-green-400" />} />
          <StatCard
            label="当前负载"
            value={`${stats.totalLoad} / ${stats.totalCapacity}`}
            icon={<Activity className="w-4 h-4 text-yellow-400" />}
          />
          <StatCard label="累计调用" value={stats.totalUsed} icon={<Wallet className="w-4 h-4 text-blue-400" />} />
        </div>
      )}

      {/* 添加表单 */}
      {showAddForm && (
        <div className="bg-runway-surface border border-runway-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-white">添加新 API Key</h3>
          {formError && (
            <p className="text-sm text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {formError}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="备注名称（如：账号1）"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="px-3 py-2 bg-runway-black border border-runway-border rounded-md text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="API Key"
              value={formKey}
              onChange={(e) => setFormKey(e.target.value)}
              className="px-3 py-2 bg-runway-black border border-runway-border rounded-md text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="并发上限"
              value={formMaxConcurrent}
              onChange={(e) => setFormMaxConcurrent(parseInt(e.target.value) || 5)}
              className="px-3 py-2 bg-runway-black border border-runway-border rounded-md text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="优先级（越大越优先）"
              value={formPriority}
              onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
              className="px-3 py-2 bg-runway-black border border-runway-border rounded-md text-sm text-white placeholder-runway-mid-slate focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              确认添加
            </button>
            <button
              onClick={() => { setShowAddForm(false); setFormError(''); }}
              className="px-4 py-1.5 text-sm bg-runway-black text-runway-slate hover:text-white rounded-md border border-runway-border"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Key 列表 */}
      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="text-center py-12 text-runway-slate">
            <Key className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>暂无 API Key，点击上方按钮添加</p>
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className={`bg-runway-surface border rounded-lg p-4 ${
                key.enabled ? 'border-runway-border' : 'border-runway-border/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{key.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-runway-black text-runway-mid-slate font-mono">
                      {key.apiKey}
                    </span>
                    {!key.enabled && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">已禁用</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-runway-slate">
                    <span>
                      并发: <span className={key.currentLoad >= key.maxConcurrent ? 'text-red-400' : 'text-green-400'}>
                        {key.currentLoad}
                      </span> / {key.maxConcurrent}
                    </span>
                    <span>累计: {key.totalUsed} 次</span>
                    <span>优先级: {key.priority}</span>
                    {key.lastUsedAt && (
                      <span>最近使用: {new Date(key.lastUsedAt).toLocaleString('zh-CN')}</span>
                    )}
                  </div>
                  {key.lastError && (
                    <p className="mt-1.5 text-xs text-red-400/80 truncate">
                      最近错误: {key.lastError}
                    </p>
                  )}
                  {balances[key.id] && (
                    <p className="mt-1.5 text-xs text-blue-400">
                      余额: {balances[key.id]}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <button
                    onClick={() => handleQueryBalance(key.id)}
                    disabled={balanceLoading[key.id]}
                    className="p-1.5 text-runway-slate hover:text-blue-400 transition-colors"
                    title="查询余额"
                  >
                    {balanceLoading[key.id] ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wallet className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggle(key.id)}
                    className="p-1.5 text-runway-slate hover:text-yellow-400 transition-colors"
                    title={key.enabled ? '禁用' : '启用'}
                  >
                    {key.enabled ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(key.id, key.name)}
                    className="p-1.5 text-runway-slate hover:text-red-400 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-runway-surface border border-runway-border rounded-lg p-3">
      <div className="flex items-center gap-2 text-runway-slate text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
