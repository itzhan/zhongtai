// 幂等种子。容器启动时跟在 migrate.mjs 后面跑, 已存在的记录会跳过。
//
// 用 .mjs + 纯 @prisma/client, 不依赖 tsx —— tsx 是 devDependency,
// 生产镜像里没有。
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_USERS = [
  { username: "admin", displayName: "管理员", role: "admin" },
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

  console.log("[seed] done (admin only)");
}

main()
  .catch((e) => {
    console.error("[seed] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
