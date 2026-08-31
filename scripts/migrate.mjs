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
  {
    table: "Project",
    columns: [
      ["ownerName", '"ownerName" TEXT NOT NULL DEFAULT \'\''],
      ["enableDemands", '"enableDemands" BOOLEAN NOT NULL DEFAULT false'],
      ["enableBatches", '"enableBatches" BOOLEAN NOT NULL DEFAULT false'],
    ],
  },
  {
    table: "Desk",
    columns: [
      ["baseUrl", '"baseUrl" TEXT NOT NULL DEFAULT \'\''],
      ["apiKind", '"apiKind" TEXT NOT NULL DEFAULT \'none\''],
      ["apiToken", '"apiToken" TEXT NOT NULL DEFAULT \'\''],
      ["apiConfigJson", '"apiConfigJson" TEXT NOT NULL DEFAULT \'{}\''],
      ["ownerName", '"ownerName" TEXT NOT NULL DEFAULT \'\''],
    ],
  },
  { table: "DeskItem", columns: [["productName", '"productName" TEXT NOT NULL DEFAULT \'\'']] },
  { table: "Supplier", columns: [["baseUrl", '"baseUrl" TEXT NOT NULL DEFAULT \'\''], ["wechat", '"wechat" TEXT NOT NULL DEFAULT \'\''], ["goods", '"goods" TEXT NOT NULL DEFAULT \'\''], ["category", '"category" TEXT NOT NULL DEFAULT \'\'']] },
  {
    table: "SupplierMonitor",
    columns: [
      ["kind", '"kind" TEXT NOT NULL DEFAULT \'openai\''],
      ["sub2SiteId", '"sub2SiteId" INTEGER'],
      ["sub2AccountId", '"sub2AccountId" INTEGER'],
      ["lastDispatchGrade", '"lastDispatchGrade" TEXT NOT NULL DEFAULT \'\''],
      ["dispatchGradeStreak", '"dispatchGradeStreak" INTEGER NOT NULL DEFAULT 0'],
      ["originPriority", '"originPriority" INTEGER'],
      ["originConcurrency", '"originConcurrency" INTEGER'],
      ["originLoadFactor", '"originLoadFactor" INTEGER'],
    ],
  },
  { table: "SupplierItem", columns: [["productName", '"productName" TEXT NOT NULL DEFAULT \'\''], ["apiKey", '"apiKey" TEXT NOT NULL DEFAULT \'\'']] },
  { table: "ProjectDemand", columns: [["sellPrice", '"sellPrice" REAL NOT NULL DEFAULT 0']] },
  {
    table: "FinanceEntry",
    columns: [
      ["costSource", '"costSource" TEXT NOT NULL DEFAULT \'self\''],
      ["supplierId", '"supplierId" INTEGER'],
    ],
  },
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

async function tableExists(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`,
  );
  return rows.length > 0;
}

async function migrateDeskProjects() {
  if (!(await tableExists("Desk"))) return;
  const deskCols = await existingCols("Desk");
  if (!deskCols.has("projectId")) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DeskProject" (
    "deskId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("deskId", "projectId"),
    FOREIGN KEY ("deskId") REFERENCES "Desk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO "DeskProject" ("deskId", "projectId") SELECT "id", "projectId" FROM "Desk" WHERE "projectId" IS NOT NULL`,
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DeskProject_projectId_idx" ON "DeskProject"("projectId")`);
  console.log("[migrate] copied Desk.projectId into DeskProject");
}

async function rewriteTable(table, createSql, selectSql, indexes) {
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys=OFF");
  await prisma.$executeRawUnsafe(createSql);
  await prisma.$executeRawUnsafe(`INSERT INTO "${table}_next" ${selectSql}`);
  await prisma.$executeRawUnsafe(`DROP TABLE "${table}"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "${table}_next" RENAME TO "${table}"`);
  for (const sql of indexes) await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys=ON");
}

async function dropProjectOwner() {
  if (!(await tableExists("Project"))) return;
  const cols = await existingCols("Project");
  if (!cols.has("ownerId") && !cols.has("ownerName")) return;
  await rewriteTable(
    "Project",
    `CREATE TABLE "Project_next" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "description" TEXT NOT NULL DEFAULT '',
      "enableDemands" BOOLEAN NOT NULL DEFAULT false,
      "enableBatches" BOOLEAN NOT NULL DEFAULT false,
      "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `SELECT id, code, name, status, description, enableDemands, enableBatches, startedAt, deletedAt, createdAt, updatedAt FROM "Project"`,
    [
      'CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code")',
      'CREATE INDEX "Project_status_idx" ON "Project"("status")',
    ],
  );
  console.log("[migrate] dropped Project.ownerId / ownerName");
}

async function dropDeskProjectId() {
  if (!(await tableExists("Desk"))) return;
  const cols = await existingCols("Desk");
  if (!cols.has("projectId")) return;
  await rewriteTable(
    "Desk",
    `CREATE TABLE "Desk_next" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "ownerId" INTEGER NOT NULL,
      "ownerName" TEXT NOT NULL DEFAULT '',
      "contact" TEXT NOT NULL DEFAULT '',
      "baseUrl" TEXT NOT NULL DEFAULT '',
      "apiKind" TEXT NOT NULL DEFAULT 'none',
      "apiToken" TEXT NOT NULL DEFAULT '',
      "apiConfigJson" TEXT NOT NULL DEFAULT '{}',
      "demand" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'active',
      "notes" TEXT NOT NULL DEFAULT '',
      "deletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `SELECT id, name, ownerId, ownerName, contact, baseUrl, apiKind, apiToken, apiConfigJson, demand, status, notes, deletedAt, createdAt, updatedAt FROM "Desk"`,
    [
      'CREATE INDEX "Desk_ownerId_idx" ON "Desk"("ownerId")',
      'CREATE INDEX "Desk_status_idx" ON "Desk"("status")',
      'CREATE INDEX "Desk_apiKind_idx" ON "Desk"("apiKind")',
    ],
  );
  console.log("[migrate] dropped Desk.projectId");
}

async function dropSupplierProjectId() {
  if (!(await tableExists("Supplier"))) return;
  const cols = await existingCols("Supplier");
  if (!cols.has("projectId")) return;
  await rewriteTable(
    "Supplier",
    `CREATE TABLE "Supplier_next" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "ownerId" INTEGER,
      "wechat" TEXT NOT NULL DEFAULT '',
      "goods" TEXT NOT NULL DEFAULT '',
      "category" TEXT NOT NULL DEFAULT '',
      "contact" TEXT NOT NULL DEFAULT '',
      "baseUrl" TEXT NOT NULL DEFAULT '',
      "channel" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'active',
      "notes" TEXT NOT NULL DEFAULT '',
      "deletedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `SELECT id, name, ownerId, wechat, goods, category, contact, baseUrl, channel, status, notes, deletedAt, createdAt, updatedAt FROM "Supplier"`,
    [
      'CREATE INDEX "Supplier_ownerId_idx" ON "Supplier"("ownerId")',
      'CREATE INDEX "Supplier_status_idx" ON "Supplier"("status")',
      'CREATE INDEX "Supplier_category_idx" ON "Supplier"("category")',
    ],
  );
  console.log("[migrate] dropped Supplier.projectId");
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

  if (await tableExists("SupplierMonitor")) {
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "SupplierMonitor_sub2SiteId_idx" ON "SupplierMonitor"("sub2SiteId")',
    );
  }

  await migrateDeskProjects();
  await dropProjectOwner();
  await dropDeskProjectId();
  await dropSupplierProjectId();
  await backfillSupplierGoods();
  await backfillDeskOwnerName();
}

async function backfillDeskOwnerName() {
  if (!(await tableExists("Desk"))) return;
  const cols = await existingCols("Desk");
  if (!cols.has("ownerName")) return;
  await prisma.$executeRawUnsafe(`
    UPDATE "Desk" SET "ownerName" = (
      SELECT "displayName" FROM "User" WHERE "User"."id" = "Desk"."ownerId"
    ) WHERE "ownerName" = '' AND "ownerId" IS NOT NULL
  `);
}

async function backfillSupplierGoods() {
  if (!(await tableExists("SupplierGood"))) return;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, goods FROM "Supplier" WHERE goods IS NOT NULL AND trim(goods) != ''`,
  );
  let created = 0;
  for (const row of rows) {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS c FROM "SupplierGood" WHERE supplierId = ${Number(row.id)}`,
    );
    if (Number(existing[0]?.c ?? 0) > 0) continue;
    const names = String(row.goods)
      .split(/[,，、/|]/)
      .map((item) => item.trim())
      .filter(Boolean);
    for (const name of names) {
      const safe = name.replaceAll("'", "''");
      await prisma.$executeRawUnsafe(
        `INSERT INTO "SupplierGood" ("supplierId", "name", "rate", "createdAt", "updatedAt") VALUES (${Number(row.id)}, '${safe}', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      );
      created++;
    }
  }
  if (created) console.log(`[migrate] backfilled ${created} supplier goods`);
}

main()
  .catch((e) => {
    console.error("[migrate] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
