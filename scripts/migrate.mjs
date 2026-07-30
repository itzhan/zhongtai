// 幂等建表 + 增量加列。容器每次启动都会跑一次, 反复执行安全。
//
// 建表 SQL 不在这里手写 —— 读 prisma/init.sql (由 prisma migrate diff
// 生成), 执行前自动补上 IF NOT EXISTS。schema 改了就重新生成那个文件:
//   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/init.sql
//
// 给【已存在的表】加列走 MANIFEST —— SQLite 只支持 ADD COLUMN
// (不支持 MODIFY / DROP), 所以只能加可空或带 DEFAULT 的列;
// 结构性重写需要单开一个脚本。
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const INIT_SQL = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "init.sql");

/// schema 演进时往这里加: { table, columns: [[列名, 完整 DDL 片段]] }
const MANIFEST = [
  ...[
    "User", "Project", "Product", "Desk", "Supplier", "ResourceSource",
    "CardResource", "ProxyResource", "EmailResource", "ResourceBusiness",
    "ResourceAllocation", "ResourceRequest", "Purchase", "ProductionBatch",
  ].map((table) => ({ table, columns: [["deletedAt", '"deletedAt" DATETIME']] })),
  {
    table: "ProductionBatch",
    columns: [
      ["resultData", '"resultData" TEXT NOT NULL DEFAULT \'\''],
      ["status", '"status" TEXT NOT NULL DEFAULT \'in_use\''],
    ],
  },
  {
    table: "EmailResource",
    columns: [["usage", '"usage" TEXT NOT NULL DEFAULT \'\'']],
  },
  {
    table: "ResourceAllocationItem",
    columns: [
      ["business", '"business" TEXT NOT NULL DEFAULT \'\''],
      ["emailId", '"emailId" INTEGER'],
      ["proxyId", '"proxyId" INTEGER'],
      ["cardId", '"cardId" INTEGER'],
      ["used", '"used" BOOLEAN NOT NULL DEFAULT false'],
    ],
  },
  { table: "Purchase", columns: [["purchaserName", '"purchaserName" TEXT NOT NULL DEFAULT \'\'']] },
  { table: "Project", columns: [["ownerName", '"ownerName" TEXT NOT NULL DEFAULT \'\'']] },
  { table: "Desk", columns: [["baseUrl", '"baseUrl" TEXT NOT NULL DEFAULT \'\'']] },
  { table: "DeskItem", columns: [["productName", '"productName" TEXT NOT NULL DEFAULT \'\'']] },
  { table: "Supplier", columns: [["baseUrl", '"baseUrl" TEXT NOT NULL DEFAULT \'\'']] },
  { table: "SupplierItem", columns: [["productName", '"productName" TEXT NOT NULL DEFAULT \'\''], ["apiKey", '"apiKey" TEXT NOT NULL DEFAULT \'\'']] },
];

async function makePurchaseProjectOptional() {
  const cols = await prisma.$queryRawUnsafe('PRAGMA table_info("Purchase")');
  const project = cols.find((c) => c.name === "projectId");
  if (!project || Number(project.notnull) === 0) return;
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys=OFF");
  await prisma.$executeRawUnsafe(`CREATE TABLE "Purchase_next" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "projectId" INTEGER,
    "requestId" INTEGER, "kind" TEXT NOT NULL, "purchaserId" INTEGER NOT NULL,
    "sourceId" INTEGER, "content" TEXT NOT NULL, "detail" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 0, "totalAmount" REAL NOT NULL DEFAULT 0,
    "purchaseDate" TEXT NOT NULL, "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("requestId") REFERENCES "ResourceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("purchaserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("sourceId") REFERENCES "ResourceSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`INSERT INTO "Purchase_next" SELECT * FROM "Purchase"`);
  await prisma.$executeRawUnsafe(`DROP TABLE "Purchase"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Purchase_next" RENAME TO "Purchase"`);
  for (const sql of [
    'CREATE INDEX "Purchase_projectId_idx" ON "Purchase"("projectId")',
    'CREATE INDEX "Purchase_requestId_idx" ON "Purchase"("requestId")',
    'CREATE INDEX "Purchase_kind_idx" ON "Purchase"("kind")',
    'CREATE INDEX "Purchase_purchaseDate_idx" ON "Purchase"("purchaseDate")',
  ]) await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys=ON");
  console.log("[migrate] Purchase.projectId is now optional");
}

/// 把 prisma 生成的 SQL 拆成可幂等执行的语句。
function loadStatements() {
  const raw = readFileSync(INIT_SQL, "utf8");
  return raw
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean)
    .map((s) =>
      s
        .replace(/^CREATE TABLE (?!IF NOT EXISTS)/i, "CREATE TABLE IF NOT EXISTS ")
        .replace(/^CREATE INDEX (?!IF NOT EXISTS)/i, "CREATE INDEX IF NOT EXISTS ")
        .replace(
          /^CREATE UNIQUE INDEX (?!IF NOT EXISTS)/i,
          "CREATE UNIQUE INDEX IF NOT EXISTS ",
        ),
    );
}

async function existingCols(table) {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
  return new Set(rows.map((r) => r.name));
}

async function main() {
  await makePurchaseProjectOptional();
  const statements = loadStatements();
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log(`[migrate] applied ${statements.length} schema statement(s)`);

  let added = 0;
  for (const { table, columns } of MANIFEST) {
    const have = await existingCols(table);
    for (const [col, def] of columns) {
      if (have.has(col)) continue;
      const sql = `ALTER TABLE "${table}" ADD COLUMN ${def}`;
      console.log(`[migrate] ${sql}`);
      await prisma.$executeRawUnsafe(sql);
      added++;
    }
  }
  console.log(added === 0 ? "[migrate] no new columns" : `[migrate] added ${added} column(s)`);
}

main()
  .catch((e) => {
    console.error("[migrate] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
