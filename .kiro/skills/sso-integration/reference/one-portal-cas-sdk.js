/**
 * One Portal CAS SSO SDK
 * 用于快速接入CAS单点登录的JavaScript SDK
 * 
 * @version 1.0.0
 * @author One Portal Team
 */
import { isTest } from '@/config'
export default class OnePortalCasSDK {
    constructor(options = {}) {
        this.config = {
            clientCode: options.clientCode || 'one-portal',
            casServerUrl: `https://one-portal${isTest ? '-test' : ''}.joy-group.com/api`,
            casPortalUrl: `https://one-portal${isTest ? '-test' : ''}.joy-group.com`,
            serviceUrl: options.serviceUrl || window.location.origin + '/cas/callback',
            tokenKey: options.tokenKey || 'one_portal_token',
            userKey: options.userKey || 'one_portal_user',
            debug: options.debug || false,
            autoLogin: options.autoLogin !== false, // 默认开启自动登录
            loginCallback: options.loginCallback || null,
            logoutCallback: options.logoutCallback || null,
            errorCallback: options.errorCallback || null
        };

        this.token = null;
        this.user = null;

        this.init();
    }

    /**
     * 初始化SDK
     */
    init() {
        this.log('OnePortal CAS SDK 初始化中...');

        // 从本地存储加载token和用户信息
        this.loadFromStorage();

        // 检查URL中是否有ST票据
        const urlParams = new URLSearchParams(window.location.search);
        const ticket = urlParams.get('ticket');
        if (this.isLoggedIn() && this.config.loginCallback) {
            this.config.loginCallback(this.user, this.token);
        } else if (ticket) {
            this.log('检测到ST票据:', ticket);
            this.validateTicket(ticket);
        } else if (this.config.autoLogin && !this.isLoggedIn()) {
            this.log('用户未登录，准备跳转到CAS登录页面');
            this.login();
        }
    }

    /**
     * 从本地存储加载数据
     */
    loadFromStorage() {
        try {
            this.token = localStorage.getItem(this.config.tokenKey);
            const userStr = localStorage.getItem(this.config.userKey);
            if (userStr) {
                this.user = JSON.parse(userStr);
            }
            this.log('从本地存储加载数据:', { token: !!this.token, user: !!this.user });
        } catch (error) {
            this.log('加载本地存储数据失败:', error);
        }
    }

    /**
     * 保存到本地存储
     */
    saveToStorage() {
        try {
            if (this.token) {
                localStorage.setItem(this.config.tokenKey, this.token);
            }
            if (this.user) {
                localStorage.setItem(this.config.userKey, JSON.stringify(this.user));
            }
            this.log('数据已保存到本地存储');
        } catch (error) {
            this.log('保存到本地存储失败:', error);
        }
    }

    /**
     * 清除本地存储
     */
    clearStorage() {
        try {
            localStorage.removeItem(this.config.tokenKey);
            localStorage.removeItem(this.config.userKey);
            this.log('本地存储已清除');
        } catch (error) {
            this.log('清除本地存储失败:', error);
        }
    }

    /**
     * 检查用户是否已登录
     */
    isLoggedIn() {
        return !!(this.token && this.user);
    }

    /**
     * 获取当前用户信息
     */
    getUser() {
        return this.user;
    }

    /**
     * 获取当前token
     */
    getToken() {
        return this.token;
    }

    /**
     * 登录 - 跳转到CAS登录页面
     */
    login() {
        const loginUrl = `${this.config.casPortalUrl}?appCode=${this.config.clientCode}&redirectUrl=${encodeURIComponent(this.config.serviceUrl)}`;
        this.log('跳转到CAS登录页面:', loginUrl);
        window.location.href = loginUrl;
    }

    /**
     * 验证ST票据
     */
    async validateTicket(ticket) {
        try {
            this.log('验证ST票据:', ticket);

            const response = await fetch(`${this.config.casServerUrl}/auth/validateST?ticket=${ticket}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                this.token = result.data.token;
                this.user = result.data.user;

                // 保存到本地存储
                this.saveToStorage();

                // 清除URL中的ticket参数
                this.clearTicketFromUrl();

                this.log('ST票据验证成功，用户登录成功:', this.user);

                // 调用登录回调
                if (this.config.loginCallback) {
                    this.config.loginCallback(this.user, this.token);
                }

                return true;
            } else {
                throw new Error(result.message || 'ST票据验证失败');
            }
        } catch (error) {
            this.log('ST票据验证失败:', error);
            this.handleError(error);
            return false;
        }
    }

    /**
     * 清除URL中的ticket参数
     */
    clearTicketFromUrl() {
        const url = new URL(window.location);
        url.searchParams.delete('ticket');
        window.history.replaceState({}, document.title, url.toString());
    }

    /**
     * 登出
     */
    async logout(redirectToLogin = true) {
        try {
            this.log('用户登出');

            // 如果有token，调用服务端登出接口
            if (this.token) {
                try {
                    await fetch(`${this.config.casServerUrl}/auth/logout`, {
                        method: 'POST',
                        headers: {
                            'AppId': this.config.clientCode,
                            'Authorization': `Bearer ${this.token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                } catch (error) {
                    this.log('调用服务端登出接口失败:', error);
                }
            }

            // 清除本地数据
            this.token = null;
            this.user = null;
            this.clearStorage();

            // 调用登出回调
            if (this.config.logoutCallback) {
                this.config.logoutCallback();
            }

            // 重定向到登录页面
            if (redirectToLogin) {
                this.login();
            }

        } catch (error) {
            this.log('登出失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 发送带认证的HTTP请求
     */
    async request(url, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        config.headers['appId'] = this.config.clientCode;

        // 添加认证头
        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);

            // 如果返回401，说明token已过期，需要重新登录
            if (response.status === 401) {
                this.log('Token已过期，需要重新登录');
                this.logout();
                return null;
            }

            return response;
        } catch (error) {
            this.log('请求失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户信息（从服务端）
     */
    async fetchUserInfo() {
        try {
            const response = await this.request(`${this.config.casServerUrl}/auth/user`);
            if (response && response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.user = result.data;
                    this.saveToStorage();
                    return this.user;
                }
            }
            return null;
        } catch (error) {
            this.log('获取用户信息失败:', error);
            return null;
        }
    }

    /**
     * 刷新token
     */
    async refreshToken() {
        // 这里可以实现token刷新逻辑
        this.log('Token刷新功能暂未实现');
    }

    /**
     * 错误处理
     */
    handleError(error) {
        this.log('发生错误:', error);
        if (this.config.errorCallback) {
            this.config.errorCallback(error);
        }
    }

    /**
     * 日志输出
     */
    log(...args) {
        if (this.config.debug) {
            console.log('[OnePortal CAS SDK]', ...args);
        }
    }

    /**
     * 检查登录状态并自动处理
     */
    checkLoginStatus() {
        if (!this.isLoggedIn() && this.config.autoLogin) {
            this.login();
            return false;
        }
        return this.isLoggedIn();
    }

    /**
     * 设置配置
     */
    setConfig(key, value) {
        this.config[key] = value;
    }

    /**
     * 获取配置
     */
    getConfig(key) {
        return this.config[key];
    }
}
