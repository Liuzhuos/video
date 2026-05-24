import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';
import { resetAllLoads } from '../services/apiKeyPool';

export const adminRouter = Router();

// 所有管理路由需要登录 + 管理员权限
adminRouter.use(authMiddleware);
adminRouter.use(adminOnly);

// ==================== API Key 管理 ====================

// GET /api/admin/api-keys - 获取所有 API Key
adminRouter.get('/api-keys', async (_req: AuthRequest, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    // 脱敏：只显示前8位和后4位
    const masked = keys.map((k) => ({
      ...k,
      apiKey: k.apiKey.length > 12
        ? k.apiKey.slice(0, 8) + '****' + k.apiKey.slice(-4)
        : '****',
    }));

    res.json({ keys: masked });
  } catch (error: any) {
    console.error('[Admin] getApiKeys error:', error);
    res.status(500).json({ error: 'Failed to get API Keys' });
  }
});

// POST /api/admin/api-keys - 添加 API Key
adminRouter.post('/api-keys', async (req: AuthRequest, res: Response) => {
  try {
    const { name, apiKey, maxConcurrent, priority, provider } = req.body;

    if (!name || !apiKey) {
      res.status(400).json({ error: 'name and apiKey are required' });
      return;
    }

    const existing = await prisma.apiKey.findFirst({
      where: { apiKey, provider: provider || 'runninghub' },
    });
    if (existing) {
      res.status(409).json({ error: 'API Key already exists' });
      return;
    }

    const key = await prisma.apiKey.create({
      data: {
        name,
        apiKey,
        provider: provider || 'runninghub',
        maxConcurrent: maxConcurrent || 5,
        priority: priority || 0,
      },
    });

    res.status(201).json({
      key: {
        ...key,
        apiKey: key.apiKey.slice(0, 8) + '****' + key.apiKey.slice(-4),
      },
    });
  } catch (error: any) {
    console.error('[Admin] addApiKey error:', error);
    res.status(500).json({ error: 'Failed to add API Key' });
  }
});

// PUT /api/admin/api-keys/:id - 更新 API Key
adminRouter.put('/api-keys/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, apiKey, maxConcurrent, priority, enabled } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (apiKey !== undefined) data.apiKey = apiKey;
    if (maxConcurrent !== undefined) data.maxConcurrent = maxConcurrent;
    if (priority !== undefined) data.priority = priority;
    if (enabled !== undefined) data.enabled = enabled;

    const key = await prisma.apiKey.update({ where: { id }, data });

    res.json({
      key: {
        ...key,
        apiKey: key.apiKey.slice(0, 8) + '****' + key.apiKey.slice(-4),
      },
    });
  } catch (error: any) {
    console.error('[Admin] updateApiKey error:', error);
    res.status(500).json({ error: 'Failed to update API Key' });
  }
});

// DELETE /api/admin/api-keys/:id - 删除 API Key
adminRouter.delete('/api-keys/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    await prisma.apiKey.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Admin] deleteApiKey error:', error);
    res.status(500).json({ error: 'Failed to delete API Key' });
  }
});

// ⚠️ 固定路径路由必须在 /:id 参数路由之前注册，否则 Express 会把路径段当成 id

// GET /api/admin/api-keys/stats - 获取 Key 池统计概览
adminRouter.get('/api-keys/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({ where: { provider: 'runninghub' } });

    const total = keys.length;
    const enabled = keys.filter((k) => k.enabled).length;
    const totalLoad = keys.reduce((sum, k) => sum + k.currentLoad, 0);
    const totalCapacity = keys.filter((k) => k.enabled).reduce((sum, k) => sum + k.maxConcurrent, 0);
    const totalUsed = keys.reduce((sum, k) => sum + k.totalUsed, 0);

    res.json({
      total,
      enabled,
      disabled: total - enabled,
      totalLoad,
      totalCapacity,
      totalUsed,
      utilization: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0,
    });
  } catch (error: any) {
    console.error('[Admin] getStats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/admin/api-keys/balances - 批量查询所有 Key 余额（并发）
adminRouter.get('/api-keys/balances', async (_req: AuthRequest, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { provider: 'runninghub' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    const baseUrl = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.cn';

    const results = await Promise.allSettled(
      keys.map(async (key) => {
        const response = await fetch(`${baseUrl}/uc/openapi/accountStatus`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Host': 'www.runninghub.cn',
            'Authorization': `Bearer ${key.apiKey}`,
          },
          body: JSON.stringify({ apikey: key.apiKey }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result: any = await response.json();
        console.log(`[Admin] Key ${key.name} accountStatus:`, JSON.stringify(result));

        if (result.code === 0) {
          const data = result.data ?? {};
          return {
            id: key.id,
            remainCoins: data.remainCoins ?? null,
            currentTaskCounts: data.currentTaskCounts ?? null,
            remainMoney: data.remainMoney ?? null,
            currency: data.currency ?? null,
            apiType: data.apiType ?? null,
          };
        } else {
          throw new Error(result.msg || result.message || 'Query failed');
        }
      })
    );

    const balances: Record<number, any> = {};
    results.forEach((result, index) => {
      const key = keys[index];
      if (result.status === 'fulfilled') {
        balances[key.id] = { success: true, ...result.value };
      } else {
        balances[key.id] = { success: false, error: result.reason?.message || 'Failed' };
      }
    });

    res.json({ balances, updatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('[Admin] batchQueryBalances error:', error);
    res.status(500).json({ error: 'Failed to query balances' });
  }
});

// POST /api/admin/api-keys/reset-loads - 重置所有负载计数
adminRouter.post('/api-keys/reset-loads', async (_req: AuthRequest, res: Response) => {
  try {
    await resetAllLoads('runninghub');
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Admin] resetLoads error:', error);
    res.status(500).json({ error: 'Failed to reset loads' });
  }
});

// POST /api/admin/api-keys/:id/toggle - 启用/禁用 API Key
adminRouter.post('/api-keys/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: { enabled: !key.enabled },
    });

    res.json({ enabled: updated.enabled });
  } catch (error: any) {
    console.error('[Admin] toggleApiKey error:', error);
    res.status(500).json({ error: 'Failed to toggle API Key' });
  }
});

// POST /api/admin/api-keys/:id/balance - 查询单个 Key 的余额
adminRouter.post('/api-keys/:id/balance', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }

    const baseUrl = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.cn';

    const response = await fetch(`${baseUrl}/uc/openapi/accountStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'www.runninghub.cn',
        'Authorization': `Bearer ${key.apiKey}`,
      },
      body: JSON.stringify({ apikey: key.apiKey }),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(500).json({ error: `Balance query failed: ${text}` });
      return;
    }

    const result: any = await response.json();
    console.log(`[Admin] Key ${key.name} accountStatus:`, JSON.stringify(result));

    if (result.code === 0) {
      const data = result.data ?? {};
      res.json({
        remainCoins: data.remainCoins ?? null,
        currentTaskCounts: data.currentTaskCounts ?? null,
        remainMoney: data.remainMoney ?? null,
        currency: data.currency ?? null,
        apiType: data.apiType ?? null,
        raw: data,
      });
    } else {
      res.status(500).json({ error: result.msg || result.message || 'Balance query failed' });
    }
  } catch (error: any) {
    console.error('[Admin] queryBalance error:', error);
    res.status(500).json({ error: 'Failed to query balance' });
  }
});
