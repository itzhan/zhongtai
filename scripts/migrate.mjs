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
const MANIFEST = [];

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
