# One Portal API Reference

## Base URLs

- Test: `https://one-portal-test.joy-group.com/api`
- Production: `https://one-portal.joy-group.com/api`

## Response Format

All APIs return:
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {},
  "success": true
}
```

Error response:
```json
{
  "code": 401,
  "message": "暂未登录或token已经过期",
  "data": null,
  "success": false
}
```

## Authentication APIs

### GET /auth/url

Get OAuth authorization URL. No auth required.

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| redirectUrl | Yes | Redirect URL after login |
| appCode | No | Application code |
| isFeishu | Yes | Whether to use Feishu silent login |

**Response:** Authorization URL string

---

### GET /auth/callback

Handle OAuth callback. No auth required.

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| code | Yes | Authorization code from Feishu |
| state | Yes | State parameter |
| redirectUrl | No | Redirect URL |

**Response:**
```json
{
  "token": "eyJ...",
  "refreshToken": "...",
  "expiresIn": 86400,
  "redirectUrl": "https://app.example.com/callback",
  "appCode": "cli_xxx"
}
```

---

### GET /auth/validateST

Validate Service Ticket. No auth required. **This is the primary API for SSO integration.**

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| ticket | Yes | ST ticket (format: `ST-{uuid}`) |

**Response:**
```json
{
  "token": "eyJ...",
  "user": {
    "id": 1,
    "name": "张三",
    "employeeCode": "E001",
    "email": "zhangsan@joy-group.com",
    "mobile": "13800138000",
    "avatar": "https://...",
    "roleCode": "admin",
    "loginType": 1
  }
}
```

**Notes:**
- ST ticket is single-use, consumed immediately after validation
- ST ticket expires after 5 minutes
- Returns the JWT token to use for subsequent requests

---

### GET /auth/user

Get current user info. **Requires authentication.**

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | `Bearer {token}` |
| appId | Yes | Application code |

**Response:**
```json
{
  "id": 1,
  "name": "张三",
  "employeeCode": "E001",
  "feishuOpenId": "ou_xxx",
  "email": "zhangsan@joy-group.com",
  "mobile": "13800138000",
  "avatar": "https://...",
  "roleCode": "admin",
  "loginType": 1,
  "userRoles": [
    { "roleId": 1, "roleName": "管理员", "roleCode": "admin" }
  ],
  "authorities": [
    { "authority": "user:list" },
    { "authority": "order:export" }
  ]
}
```

---

### GET /auth/generateST

Generate Service Ticket for CAS SSO. **Requires authentication.**

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | `Bearer {token}` |
| appId | Yes | Application code |

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| appCode | Yes | Target application code |

**Response:** ST ticket string (e.g., `ST-abc123def456`)

---

### POST /auth/password-login

Login with password. No auth required.

**Request Body:**
```json
{
  "loginType": 2,
  "mobile": "13800138000",
  "password": "your-password"
}
```

loginType: 2=mobile, 3=email. When loginType=3, use `email` field instead of `mobile`.

**Response:**
```json
{
  "token": "eyJ...",
  "user": { ... },
  "expiresIn": 86400
}
```

---

### POST /auth/refresh

Refresh token. No auth required.

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| refreshToken | Yes | Refresh token from login |

**Response:**
```json
{ "token": "eyJ..." }
```

---

### POST /auth/logout

Logout. **Requires authentication.**

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | `Bearer {token}` |
| appId | Yes | Application code |

---

## Open APIs (No Auth Required)

### POST /api/users/batchQuery

Batch query users by IDs or employee codes.

**Request Body:**
```json
{
  "userIds": [1, 2, 3],
  "employeeCodes": ["E001", "E002"]
}
```

---

### POST /api/users/updatePassword

Update user login password.

**Request Body:**
```json
{
  "userId": 1,
  "password": "new-password"
}
```

Password will be stored with BCrypt encryption.

---

### GET /api/application/{appCode}

Get application info by appCode.

**Response:**
```json
{
  "id": 1,
  "appCode": "cli_xxx",
  "appName": "PLM系统",
  "appUrl": "https://plm.joy-group.com"
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized / Token Expired |
| 403 | Forbidden / User Disabled |
| 500 | Internal Server Error |

## Token Lifecycle

- JWT token expires in **24 hours**
- ST (Service Ticket) expires in **5 minutes** and is single-use
- Redis state code expires in **10 minutes**
- Refresh token can be used to get a new JWT token without re-login