# 中转利润管理中台 — 给 AI 的项目约定

单体 Next.js 15 App Router 应用，前后端同仓。业务是「看清每个项目的成本、利润、生产情况」。
详细的业务说明看 `README.md`，这里只列写代码时必须遵守的约定。

## 单一数据源，别建第二份

| 东西 | 唯一定义处 | 说明 |
|---|---|---|
| 角色常量 | `src/lib/rbac.ts` | `admin 隐式全通`的规则只在 `hasRole()` 里写一次 |
| 侧边栏 + 路由权限 | `src/lib/nav.ts` | 必须保持**纯数据、零 JSX、零 React import**——middleware 在 Edge runtime import 它，import lucide 会把整个图标库打进 edge bundle。图标用字符串 key，`Sidebar.tsx` 里映射成组件 |
| 字段脱敏规则 | `src/lib/mask.ts` | API 层脱敏。前端的 `src/lib/fields.ts` 只决定「渲不渲染这一列」，**不是安全边界** |
| 状态枚举与中文标签 | `src/lib/enums.ts` | SQLite 下 Prisma 无 enum，合法值全在这里；配套的 `_LABEL` 和 `_VARIANT` 也在这 |
| 利润公式 | `src/lib/profit.ts` | 改口径只改这一个文件 |
| 图表颜色 | `src/lib/chart-theme.ts` | 全项目唯一允许写颜色字面量的地方（recharts 不吃 Tailwind class） |

## 后端

- **每个 route handler 第一行必须自证权限**：GET 用 `requireRole(...)`，POST/PATCH/DELETE 用 `requireRoleFresh(...)`（后者回查数据库，让被停用/改角色的用户拿旧 token 也写不了）。不要依赖 middleware——它的 matcher 无论怎么写都是黑名单。
- 返回约定：`{ item }` / `{ items }` / `{ ok: true }`；失败 `{ error: "中文文案" }` + 400/401/403/404。
- 脱敏用 `jsonItem(entity, role, x)` / `jsonItems(...)` 一行返回，它顺带满足上面的返回约定。
- Next 15 的 `ctx.params` 是 Promise，必须 `await`。
- **`route.ts` 只能导出 HTTP 方法和 runtime 等配置**，导出别的东西会让构建报类型错误。共用逻辑放 `src/lib/`（例如 `partner.ts`）。
- 行级权限写在 handler 的 `where` 里：销售只看 `ownerId = 自己` 的台子，生产只看自己提的申报。

## 前端

- 每个页面第一个元素是 `<PageHeader>`，不要各自手写 `h1`。带子页的模块（resources / production）由 layout 出 `PageHeader` + `<TabNav />`，tab 从 `nav.ts` 自动推导。
- 请求走 `api` / `mutate`（`src/lib/api-client.ts`），不要裸写 `fetch`。
- 列表页固定骨架：`PageHeader → 筛选条 → Card > DataState > Table → Dialog`，数据用 `useList(path)`，筛选条件 `useMemo` 拼进 path 让它自动重取。
- 搜索框加 `useDebounced`。
- 删除确认用 `<ConfirmDialog>`，**不要用原生 `confirm()`**。
- 明细行的 `key` 用 `crypto.randomUUID()`，用数组下标会在删中间行时让 React 复用错行、输入框内容串位。
- 颜色只用语义 token：`primary` / `success` / `warning` / `destructive` / `info` / `purple`，以及 `muted-foreground` 这类。**不要写 `bg-emerald-100` 这种硬编码调色板**，暗色模式不会跟随。

## 数据层

- 不用 `prisma migrate`。改完 `schema.prisma` 后重新生成 `prisma/init.sql`：
  ```bash
  npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/init.sql
  ```
  `scripts/migrate.mjs` 会读它、自动补 `IF NOT EXISTS` 后逐条执行。给已有表**加列**走该文件里的 `MANIFEST`（SQLite 只支持 `ADD COLUMN`）。
- 业务日历日（`periodDate` / `batchDate` / `purchaseDate`）存 `"YYYY-MM-DD"` **字符串**不是 DateTime——口径是 Asia/Shanghai 自然日，用 DateTime 会跨时区偏移一天。字典序即时间序，可以直接做范围比较。取今天用 `todayStr()`。
- 「发生时刻」（`createdAt` / `handledAt` / `expiresAt`）才用 DateTime。

## 两个容易踩的业务语义

1. **供货方明细的 `quantity` 是「已进货数量」，0 表示「仅报价、尚未进货」**。成本聚合只累加 `quantity > 0` 的行——否则录一个供应商报价，利润就凭空掉一截。
2. **代理 IP 的 `protocol`(socks/http) 与 `ipType`(static/dynamic) 是两个正交维度**。动态 IP 同样分 socks/http，只是出口 IP 会变，不要合成一个复合枚举。

## 产品的 status / capacity 是自由文本

需求明确要求，不要加枚举或数值约束。空值前端渲染成 `-`。状态的 Badge 颜色由 `src/lib/product-status.ts` 的关键词表推导，**推导不出就回落中性灰**——保证任何文本都长得像有意为之。

## 验证

```bash
npx tsc --noEmit      # 类型
npm run build         # 生产构建
npm run db:reset      # 重置数据
```

跑权限相关改动时，用五个 seed 账号逐个 curl 验证，别只看管理员。
