# 中转利润管理中台

看清每个项目的成本、利润与生产情况。

- **项目**是一切的归集维度：台子、供货方、采购、产出批次都挂在项目下
- **台子**是下游客户（收入侧），**供货方**是上游供应商（成本侧），两者各挂多条货明细
- **资源库**管三类生产基础资源：卡 / 代理 IP / 邮箱，外加它们的来源渠道
- **生产**查看分配给自己的资源，按项目上传 SK 等产出结果
- 五个角色各看各的部分，敏感字段在 API 层脱敏

## 快速开始

```bash
npm install
npm run db:reset      # 建表 + 播种 5 个角色账号
npm run dev           # http://localhost:3100
```

初始账号（密码统一取 `INITIAL_ADMIN_PASSWORD`，默认 `ab123168`，**首次登录后请立刻改掉**）：

| 用户名 | 角色 |
|---|---|
| `admin` | 管理员 |
| `sales` | 销售 |
| `production` | 生产 |
| `finance` | 财务 |
| `resource` | 资源管理员 |

## 角色能看到什么

权限只在 `src/lib/nav.ts` 定义一次，侧边栏、路由拦截、Tab 条三者共用同一份数据。

| | 仪表盘 | 项目 | 产品 | 台子 | 供货方 | 生产 | 资源库 | 采购 |
|---|---|---|---|---|---|---|---|---|
| 管理员 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 销售 | ✓ | ✓ | ✓ | 仅自己的 | | | | |
| 生产 | ✓ | ✓ | ✓ | | | ✓ | 除卡外 | |
| 财务 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 资源管理员 | ✓ | ✓ | ✓ | | ✓ | 申报 | ✓ | ✓ |

页面级之外还有**字段脱敏**（`src/lib/mask.ts`）：生产看不到卖价和供应商价格，销售看不到进价，销售财务看不到代理密码。卡资源页按需求直接显示卡号与 CVV。脱敏在 API 层做；仪表盘中销售拿到的 JSON 里不存在 `cost` / `profit` 字段。

## 利润怎么算

公式只在 `src/lib/profit.ts` 定义一次：

```
收入 = Σ 台子明细(数量 × 卖价)
成本 = Σ 采购记录金额 + Σ 供货方明细(已进货量 × 进货价)
利润 = 收入 − 成本
```

⚠️ 供货方明细里**已进货量为 0 的行只是报价，不计入成本**。录一条报价不会让利润凭空掉一截。

## 接码插件

邮箱的「一键获取收件箱」走插件框架，本期只带一个 mock 实现。加一个真实 provider 三步：

1. 新建 `src/lib/mailproviders/<name>.ts`，实现 `MailProvider` 接口，文件末尾 `registerProvider(x)`
2. 在 `src/lib/mailproviders/index.ts` 加一行 `import "./<name>";` ← 整个框架唯一要手改的地方
3. 打开「资源库 → 邮箱 → 接码插件配置」，填该 provider 用 `configFields` 声明的字段（表单自动渲染）

零 handler 改动、零 schema 改动。

## 数据库

SQLite + Prisma，16 张表。**不用 `prisma migrate`**：

- `prisma/init.sql` 由 `prisma migrate diff` 生成，改完 schema 后重新生成一次：
  ```bash
  npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/init.sql
  ```
- `scripts/migrate.mjs` 读它并自动补 `IF NOT EXISTS` 后逐条执行，容器每次启动都跑，幂等
- 给已有表加列走 `migrate.mjs` 里的 `MANIFEST`（SQLite 只支持 `ADD COLUMN`）

```bash
npm run db:push     # 开发时直接推 schema
npm run db:seed     # 幂等播种
npm run db:reset    # 删库重建 + 播种
```

## 部署

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
docker compose up -d --build
# http://localhost:3181
```

容器启动时会依次跑 `migrate.mjs` → `seed.mjs` → `server.js`，前两步幂等，重启不会重复建用户。

> ⚠️ **从旧版本升级**：`./data/app.db` 里可能还留着上一代「中转站账单」业务的 35 张表。新旧表不冲突（迁移只做 `CREATE TABLE IF NOT EXISTS`），但如果你想要一个干净的库，先备份再删掉那个文件：
> ```bash
> mv data/app.db data/app.db.old
> ```

## 约定

改代码前先看这几条，它们决定了新页面该长什么样：

- 每个页面的第一个元素是 `<PageHeader>`，不要各自手写 `h1`
- 列表端点统一返回 `{ items }`，单个返回 `{ item }`，失败返回 `{ error: "中文文案" }`
- 前端所有请求走 `src/lib/api-client.ts` 的 `api` / `mutate`，不要裸写 `fetch`
- 列表页固定用 `useList` + `<DataState>` 三态，不要各自实现 loading/error/empty
- **每个 route handler 第一行必须 `requireRole`**（GET）或 `requireRoleFresh`（写操作），不要依赖 middleware
- 颜色只用语义 token（`primary` / `success` / `warning` / `destructive` / `info` / `purple`），唯一允许写颜色字面量的地方是 `src/lib/chart-theme.ts`
- 明细行的 `key` 必须用 `crypto.randomUUID()`，用数组下标会在删中间行时让输入框串位

## 技术栈

Next.js 15 App Router · React 18 · TypeScript strict · Prisma + SQLite · Tailwind + shadcn 风格自建组件 · recharts · sonner · next-themes
