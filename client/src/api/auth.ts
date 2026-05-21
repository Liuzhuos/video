import { authFetch, setToken, setUser } from './request';

interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
    nickname: string;
    role: string;
  };
}

export async function register(username: string, password: string, nickname?: string): Promise<AuthResponse> {
  const response = await authFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, nickname }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '注册失败');
  }

  const data: AuthResponse = await response.json();
  setToken(data.token);
  setUser(data.user);
  return data;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const response = await authFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '登录失败');
  }

  const data: AuthResponse = await response.json();
  setToken(data.token);
  setUser(data.user);
  return data;
}

export async function getMe() {
  const response = await authFetch('/api/auth/me');
  if (!response.ok) {
    throw new Error('获取用户信息失败');
  }
  const data = await response.json();
  return data.user;
}
