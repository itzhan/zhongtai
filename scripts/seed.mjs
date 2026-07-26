// 幂等种子。容器启动时跟在 migrate.mjs 后面跑, 已存在的记录会跳过。
//
// 用 .mjs + 纯 @prisma/client, 不依赖 tsx —— tsx 是 devDependency,
// 生产镜像里没有。
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/// 五个角色各一个初始账号。首次登录后应立刻改密码。
const SEED_USERS = [
  { username: "admin", displayName: "管理员", role: "admin" },
  { username: "sales", displayName: "销售", role: "sales" },
  { username: "production", displayName: "生产", role: "production" },
  { username: "finance", displayName: "财务", role: "finance" },
  { username: "resource", displayName: "资源管理员", role: "resource" },
];

async function main() {
  const password = process.env.INITIAL_ADMIN_PASSWORD || "ab123168";
  const passwordHash = await bcrypt.hash(password, 10);

  for (const u of SEED_USERS) {
    const exists = await prisma.user.findUnique({ where: { username: u.username } });
    if (exists) continue;
    await prisma.user.create({ data: { ...u, passwordHash } });
    console.log(`[seed] user ${u.username} (${u.role})`);
  }

  // 默认启用 mock 接码插件, 保证"一键获取收件箱"开箱可用。
  await prisma.emailProviderConfig.upsert({
    where: { providerKey: "mock" },
    update: {},
    create: {
      providerKey: "mock",
      label: "Mock (测试用)",
      enabled: true,
      configJson: "{}",
    },
  });

  console.log("[seed] done");
}

main()
  .catch((e) => {
    console.error("[seed] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
