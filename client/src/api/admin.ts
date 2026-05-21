import { authFetch } from './request';

export interface ApiKeyItem {
  id: number;
  provider: string;
  name: string;
  apiKey: string; // 脱敏后的
  maxConcurrent: number;
  currentLoad: number;
  totalUsed: number;
  enabled: boolean;
  priority: number;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyStats {
  total: number;
  enabled: number;
  disabled: number;
  totalLoad: number;
  totalCapacity: number;
  totalUsed: number;
  utilization: number;
}

// 获取所有 API Key
export async function getApiKeys(): Promise<ApiKeyItem[]> {
  const res = await authFetch('/api/admin/api-keys');
  if (!res.ok) throw new Error('获取 API Keys 失败');
  const data = await res.json();
  return data.keys;
}

// 获取统计概览
export async function getApiKeyStats(): Promise<ApiKeyStats> {
  const res = await authFetch('/api/admin/api-keys/stats');
  if (!res.ok) throw new Error('获取统计失败');
  return await res.json();
}

// 添加 API Key
export async function addApiKey(params: {
  name: string;
  apiKey: string;
  maxConcurrent?: number;
  priority?: number;
}): Promise<ApiKeyItem> {
  const res = await authFetch('/api/admin/api-keys', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '添加失败');
  }
  const data = await res.json();
  return data.key;
}

// 更新 API Key
export async function updateApiKey(id: number, params: Partial<{
  name: string;
  apiKey: string;
  maxConcurrent: number;
  priority: number;
  enabled: boolean;
}>): Promise<ApiKeyItem> {
  const res = await authFetch(`/api/admin/api-keys/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '更新失败');
  }
  const data = await res.json();
  return data.key;
}

// 删除 API Key
export async function deleteApiKey(id: number): Promise<void> {
  const res = await authFetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('删除失败');
}

// 切换启用/禁用
export async function toggleApiKey(id: number): Promise<boolean> {
  const res = await authFetch(`/api/admin/api-keys/${id}/toggle`, { method: 'POST' });
  if (!res.ok) throw new Error('操作失败');
  const data = await res.json();
  return data.enabled;
}

// 查询余额
export async function queryBalance(id: number): Promise<{ balance: any; raw: any }> {
  const res = await authFetch(`/api/admin/api-keys/${id}/balance`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '查询余额失败');
  }
  return await res.json();
}

// 重置所有负载计数
export async function resetLoads(): Promise<void> {
  const res = await authFetch('/api/admin/api-keys/reset-loads', { method: 'POST' });
  if (!res.ok) throw new Error('重置失败');
}
