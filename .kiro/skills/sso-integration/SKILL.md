---
name: sso-integration
description: Guide external projects through One Portal SSO integration. Use when a project needs to integrate CAS single sign-on with One Portal authentication center. Supports frontend (Vue/React), Java backend (Spring Boot starter), and generic HTTP API integration. Interactively collects project info (appCode, callback URL, tech stack) then generates complete integration code and configuration.
---

# One Portal SSO Integration Skill

Help external projects integrate with One Portal CAS SSO authentication center.

## Bundled References

- `reference/one-portal-cas-sdk.js` — Frontend JS SDK source. Read this to understand the SDK API when generating integration code.
- `reference/api-reference.md` — Complete API documentation (endpoints, headers, response formats).

## Workflow

### Phase 1: Collect Integration Info

Ask the user the following questions using AskUserQuestion:

1. **Tech stack** — Frontend only (Vue/React) / Frontend + Java backend / Frontend + other backend / Java backend only
2. **appCode** — The application code registered in One Portal (e.g., `cli_a7b6f2255126100d`)
3. **Callback URL** — Where to redirect after login (e.g., `https://app.joy-group.com/cas/callback`)
4. **Environment** — Test / Production / Both
5. **Frontend framework** (if applicable) — Vue 3 / React / Vanilla JS
6. **Need role-based access control?** — Yes / No

### Phase 2: Generate Integration Code

Based on collected info, generate the appropriate code:

#### Frontend Integration

Generate based on the framework choice:

**Vue 3 Example:**
```javascript
// src/plugins/sso.js
import OnePortalCasSDK from '@/sdk/one-portal-cas-sdk'

const sso = new OnePortalCasSDK({
  clientCode: '{{appCode}}',
  serviceUrl: '{{callbackUrl}}',
  debug: process.env.NODE_ENV !== 'production',
  loginCallback: (user, token) => {
    // Store to your state management (Pinia/Vuex)
    store.setUser(user)
    store.setToken(token)
  },
  logoutCallback: () => {
    store.clearUser()
    router.push('/login')
  }
})

export default sso
```

**Router guard:**
```javascript
// src/router/index.js
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !sso.isLoggedIn()) {
    sso.login()
    return
  }
  next()
})
```

**Axios interceptor:**
```javascript
// src/utils/request.js
import sso from '@/plugins/sso'

axios.interceptors.request.use(config => {
  const token = sso.getToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
    config.headers['appId'] = sso.getConfig('clientCode')
  }
  return config
})

axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      sso.logout()
    }
    return Promise.reject(error)
  }
)
```

#### Java Backend Integration

Generate a filter/interceptor that validates the JWT token against One Portal:

**Dependencies (pom.xml):**
```xml
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.11.5</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.11.5</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.11.5</version>
    <scope>runtime</scope>
</dependency>
```

**Configuration (application.yml):**
```yaml
one-portal:
  base-url: https://one-portal{{'-test' if test}}.joy-group.com/api
  app-code: {{appCode}}
```

**Token validation filter:**
```java
@Component
@RequiredArgsConstructor
public class OnePortalAuthFilter extends OncePerRequestFilter {
    private final OnePortalClient onePortalClient;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain chain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token == null) {
            response.setStatus(401);
            return;
        }

        LoginUser user = onePortalClient.validateToken(token);
        if (user == null) {
            response.setStatus(401);
            return;
        }

        // Set to SecurityContext or your own UserContext
        UserContext.set(user);
        try {
            chain.doFilter(request, response);
        } finally {
            UserContext.clear();
        }
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7).trim();
        }
        return null;
    }
}
```

**One Portal HTTP client:**
```java
@Component
public class OnePortalClient {
    @Value("${one-portal.base-url}")
    private String baseUrl;

    @Value("${one-portal.app-code}")
    private String appCode;

    private final RestTemplate restTemplate = new RestTemplate();

    public LoginUser validateToken(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);
        headers.set("appId", appCode);

        try {
            ResponseEntity<Result<LoginUser>> resp = restTemplate.exchange(
                baseUrl + "/auth/user",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<>() {}
            );
            return resp.getBody() != null && resp.getBody().isSuccess()
                ? resp.getBody().getData() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
```

#### Generic HTTP API Integration

For non-Java backends, provide the HTTP API reference:

| API | Method | Auth | Description |
|-----|--------|------|-------------|
| `/auth/validateST?ticket=ST-xxx` | GET | No | Validate ST ticket, returns token + user |
| `/auth/user` | GET | Bearer token + appId header | Get current user info |
| `/auth/logout` | POST | Bearer token + appId header | Logout |
| `/api/users/batchQuery` | POST | No (internal) | Batch query users |
| `/api/application/{appCode}` | GET | No (internal) | Get app info by appCode |

**Response format:**
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... },
  "success": true
}
```

**User object fields:**
```json
{
  "id": 1,
  "name": "张三",
  "employeeCode": "E001",
  "email": "zhangsan@joy-group.com",
  "mobile": "13800138000",
  "avatar": "https://...",
  "roleCode": "admin"
}
```

### Phase 3: Provide Integration Checklist

After generating code, output a checklist:

1. [ ] Register application in One Portal admin (get appCode)
2. [ ] Configure callback URL in application settings
3. [ ] Copy SDK file or install via package manager
4. [ ] Add authentication configuration
5. [ ] Implement login/logout UI
6. [ ] Add route guards (frontend) or request filter (backend)
7. [ ] Handle 401 responses (auto redirect to login)
8. [ ] Test in test environment first
9. [ ] Switch to production URL before go-live

### Key Integration Points

**Authentication URLs:**
- Test: `https://one-portal-test.joy-group.com`
- Production: `https://one-portal.joy-group.com`
- API Base: `{portal-url}/api`

**Required Headers for authenticated requests:**
- `Authorization: Bearer {token}` — JWT token from login
- `appId: {appCode}` — Application identifier

**SSO Login Flow:**
1. Frontend redirects to: `{portal-url}?appCode={appCode}&redirectUrl={callbackUrl}`
2. User authenticates (Feishu OAuth or password)
3. Portal redirects back: `{callbackUrl}?ticket=ST-xxxxx`
4. Frontend/Backend validates ticket: `GET {api-base}/auth/validateST?ticket=ST-xxxxx`
5. Response contains JWT token + user info
6. Use token for subsequent API calls

**Token Expiry:** 24 hours. On 401, redirect user to re-login.