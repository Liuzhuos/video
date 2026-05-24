/**
 * API Key 池管理服务
 * 
 * 负责从数据库加载可用 Key，按负载均衡策略分配 Key，
 * 并在任务完成后释放计数。
 */

import prisma from './prisma';

export interface PooledKey {
  id: number;
  apiKey: string;
  name: string;
  maxConcurrent: number;
  currentLoad: number;
  priority: number;
}

/**
 * 获取一个可用的 API Key（最少负载优先）
 *
 * 使用数据库事务 + 行锁（SELECT ... FOR UPDATE）保证原子性，
 * 避免并发请求同时读到相同的 currentLoad 导致超出 maxConcurrent 上限。
 *
 * @param provider 服务商标识，默认 "runninghub"
 * @returns PooledKey 或 null（无可用 Key）
 */
export async function acquireKey(provider: string = 'runninghub'): Promise<PooledKey | null> {
  return prisma.$transaction(async (tx) => {
    // SELECT ... FOR UPDATE：锁定符合条件的行，阻止其他并发事务同时修改
    // 只取负载最低、优先级最高的一行
    const available = await tx.$queryRaw<PooledKey[]>`
      SELECT id, api_key as apiKey, name, max_concurrent as maxConcurrent, current_load as currentLoad, priority
      FROM api_keys
      WHERE provider = ${provider} AND enabled = true AND current_load < max_concurrent
      ORDER BY priority DESC, current_load ASC
      LIMIT 1
      FOR UPDATE
    `;

    if (available.length === 0) {
      return null;
    }

    const selected = available[0];

    // 在同一事务内递增，保证读到的值和写入的值一致
    await tx.$executeRaw`
      UPDATE api_keys
      SET current_load = current_load + 1,
          total_used   = total_used + 1,
          last_used_at = NOW()
      WHERE id = ${selected.id}
    `;

    return { ...selected, currentLoad: selected.currentLoad + 1 };
  });
}

/**
 * 释放 Key（任务完成或失败后调用）
 */
export async function releaseKey(keyId: number): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      currentLoad: { decrement: 1 },
    },
  });

  // 防止 currentLoad 变为负数
  await prisma.apiKey.updateMany({
    where: { id: keyId, currentLoad: { lt: 0 } },
    data: { currentLoad: 0 },
  });
}

/**
 * 记录 Key 错误信息
 */
export async function recordKeyError(keyId: number, error: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      lastErrorAt: new Date(),
      lastError: error.slice(0, 500),
    },
  });
}

/**
 * 获取所有 Key 的状态（管理用）
 */
export async function getAllKeys(provider?: string) {
  const where = provider ? { provider } : {};
  return prisma.apiKey.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
}

/**
 * 重置所有 Key 的 currentLoad（服务重启时调用，防止计数泄漏）
 */
export async function resetAllLoads(provider: string = 'runninghub'): Promise<void> {
  await prisma.apiKey.updateMany({
    where: { provider },
    data: { currentLoad: 0 },
  });
  console.log(`[ApiKeyPool] 已重置 ${provider} 所有 Key 的负载计数`);
}
