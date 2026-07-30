import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { rawPrisma?: PrismaClient };
const client = globalForPrisma.rawPrisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.rawPrisma = client;

const SOFT_DELETE_MODELS = new Set([
  "User", "Project", "Product", "Desk", "Supplier", "ResourceSource",
  "CardResource", "ProxyResource", "EmailResource", "ResourceBusiness",
  "ResourceAllocation", "ResourceRequest", "Purchase", "ProductionBatch",
]);
const FILTERED_OPERATIONS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow",
  "findMany", "count", "aggregate", "groupBy",
]);

export const rawPrisma = client;
// Prisma 的动态扩展类型与 TransactionClient 不兼容，但扩展不会改变
// 客户端的模型方法契约。对外保持标准客户端类型，避免污染事务辅助函数。
export const prisma = client.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (model && SOFT_DELETE_MODELS.has(model) && FILTERED_OPERATIONS.has(operation)) {
          const queryArgs = args as { where?: Record<string, unknown> };
          queryArgs.where = { ...(queryArgs.where ?? {}), deletedAt: null };
        }
        return query(args);
      },
    },
  },
}) as unknown as PrismaClient;
