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

  for (const [sortOrder, name] of ["Claude", "GPT"].entries()) {
    await prisma.resourceBusiness.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder },
    });
  }

  const users = Object.fromEntries(
    (await prisma.user.findMany()).map((user) => [user.role, user]),
  );
  const today = new Date().toISOString().slice(0, 10);

  const mainProject = await prisma.project.upsert({
    where: { code: "DEMO-AI-ROUTER" },
    update: { ownerName: "林负责人" },
    create: {
      code: "DEMO-AI-ROUTER",
      name: "AI 中转生产项目",
      status: "active",
      ownerId: users.sales.id,
      ownerName: "林负责人",
      description: "用于调试资源采购、分配、生产和销售闭环。",
    },
  });
  const backupProject = await prisma.project.upsert({
    where: { code: "DEMO-OVERSEAS" },
    update: { ownerName: "周负责人" },
    create: {
      code: "DEMO-OVERSEAS",
      name: "海外节点项目",
      status: "paused",
      ownerId: users.sales.id,
      ownerName: "周负责人",
      description: "用于测试暂停状态、代理资源和多项目筛选。",
    },
  });

  async function ensureProduct(name, projectId, data) {
    const existing = await prisma.product.findFirst({ where: { name, projectId } });
    return existing ?? prisma.product.create({ data: { name, projectId, ...data } });
  }
  const claudeProduct = await ensureProduct("Claude API 套餐", mainProject.id, { status: "稳定供货", capacity: "日均 300 份", notes: "演示产品", sortOrder: 1 });
  const gptProduct = await ensureProduct("GPT API 套餐", mainProject.id, { status: "正常生产", capacity: "日均 500 份", notes: "演示产品", sortOrder: 2 });
  const proxyProduct = await ensureProduct("海外代理节点", backupProject.id, { status: "测试阶段", capacity: "日均 80 个", notes: "演示产品", sortOrder: 3 });

  async function ensureSource(name, data) {
    const existing = await prisma.resourceSource.findFirst({ where: { name } });
    return existing ?? prisma.resourceSource.create({ data: { name, ...data } });
  }
  const fullSource = await ensureSource("CloudResource 渠道", { kinds: "email,proxy,card", active: true, notes: "综合资源渠道，供应 GPT/Claude 邮箱、美国代理 IP 和虚拟卡，交付速度稳定。" });
  const mailSource = await ensureSource("MailHub 邮箱渠道", { kinds: "email", active: true, notes: "专注 Outlook 与 Gmail 资源，可按业务类型批量提供并支持售后补换。" });
  const cardSource = await ensureSource("CardFlow 虚拟卡", { kinds: "card", active: true, notes: "提供美元虚拟卡，适用于 Claude 与 GPT 业务，可按余额灵活分配。" });

  async function ensureEmail(address, data) {
    return prisma.emailResource.upsert({ where: { address }, update: data, create: { address, ...data } });
  }
  const emails = await Promise.all([
    ensureEmail("claude.demo01@example.com", { password: "DemoMail#01", providerKey: "mock", usage: "Claude,GPT", status: "available", sourceId: fullSource.id, projectId: mainProject.id, notes: "演示邮箱" }),
    ensureEmail("gpt.demo02@example.com", { password: "DemoMail#02", providerKey: "mock", usage: "GPT", status: "available", sourceId: mailSource.id, projectId: mainProject.id, notes: "演示邮箱" }),
    ensureEmail("shared.demo03@example.com", { password: "DemoMail#03", providerKey: "mock", usage: "Claude,GPT", status: "available", sourceId: mailSource.id, projectId: mainProject.id, notes: "可跨业务复用" }),
  ]);

  async function ensureProxy(host, port, data) {
    const existing = await prisma.proxyResource.findFirst({ where: { host, port } });
    return existing ?? prisma.proxyResource.create({ data: { host, port, ...data } });
  }
  const proxies = await Promise.all([
    ensureProxy("198.51.100.21", 1080, { protocol: "socks", ipType: "static", username: "demo_us_1", password: "Proxy#01", region: "US", expiresAt: new Date("2026-12-31T23:59:59Z"), status: "available", sourceId: fullSource.id, projectId: mainProject.id, notes: "美国静态节点" }),
    ensureProxy("203.0.113.18", 8080, { protocol: "http", ipType: "dynamic", username: "demo_sg_1", password: "Proxy#02", region: "SG", rotateUrl: "https://rotate.example/demo", expiresAt: new Date("2026-11-30T23:59:59Z"), status: "available", sourceId: fullSource.id, projectId: backupProject.id, notes: "新加坡动态节点" }),
  ]);

  async function ensureCard(cardNo, data) {
    const existing = await prisma.cardResource.findFirst({ where: { cardNo } });
    return existing ?? prisma.cardResource.create({ data: { cardNo, ...data } });
  }
  const cards = await Promise.all([
    ensureCard("4242424242424242", { cvv: "424", expiry: "12/30", holder: "DEMO ONE", amount: 420, usage: "Claude,GPT", status: "available", sourceId: cardSource.id, projectId: mainProject.id, notes: "初始 600，演示已分配 180" }),
    ensureCard("5555555555554444", { cvv: "555", expiry: "09/29", holder: "DEMO TWO", amount: 300, usage: "GPT", status: "available", sourceId: cardSource.id, projectId: mainProject.id, notes: "演示卡" }),
  ]);

  async function ensureDesk(name, data, itemData) {
    const existing = await prisma.desk.findFirst({ where: { name } });
    if (existing) return existing;
    return prisma.desk.create({ data: { name, ...data, items: { create: itemData } } });
  }
  await ensureDesk("Northwind API 台子", { ownerId: users.sales.id, projectId: mainProject.id, baseUrl: "https://northwind.example.com/v1", demand: "每天需要 Claude 和 GPT 套餐，优先保证稳定性。", status: "active", notes: "演示台子" }, [
    { productId: claudeProduct.id, productName: claudeProduct.name, quantity: 1, unitPrice: 42, note: "Claude 卖价" },
    { productId: gptProduct.id, productName: gptProduct.name, quantity: 1, unitPrice: 35, note: "GPT 卖价" },
  ]);
  await ensureDesk("Orbit 测试台子", { ownerId: users.sales.id, projectId: backupProject.id, baseUrl: "https://orbit.example.com/api", demand: "测试海外代理节点，稳定后转为正式合作。", status: "paused", notes: "演示台子" }, [
    { productId: proxyProduct.id, productName: proxyProduct.name, quantity: 1, unitPrice: 12, note: "节点卖价" },
  ]);

  const demoSupplier = await prisma.supplier.findFirst({ where: { name: "Atlas 上游台子" } });
  if (!demoSupplier) await prisma.supplier.create({
    data: {
      name: "Atlas 上游台子", ownerId: users.resource.id, projectId: mainProject.id,
      baseUrl: "https://atlas.example.com/api", status: "active", notes: "演示供货方",
      items: { create: [
        { productId: claudeProduct.id, productName: claudeProduct.name, apiKey: "sk-atlas-claude-demo", quantity: 1, unitPrice: 18, note: "Claude 进货价" },
        { productId: gptProduct.id, productName: gptProduct.name, apiKey: "sk-atlas-gpt-demo", quantity: 1, unitPrice: 15, note: "GPT 进货价" },
      ] },
    },
  });

  async function ensurePurchase(content, data) {
    const existing = await prisma.purchase.findFirst({ where: { content } });
    return existing ?? prisma.purchase.create({ data: { content, ...data } });
  }
  await ensurePurchase("采购演示邮箱资源", { kind: "email", purchaserId: users.resource.id, purchaserName: "陈采购", sourceId: mailSource.id, detail: "Outlook 邮箱 50 个，批量采购优惠后结算。", quantity: 0, totalAmount: 125, purchaseDate: today, notes: "" });
  await ensurePurchase("采购演示代理资源", { kind: "proxy", purchaserId: users.resource.id, purchaserName: "李采购", sourceId: fullSource.id, detail: "美国静态代理与新加坡动态代理月度续费。", quantity: 0, totalAmount: 86, purchaseDate: today, notes: "" });
  await ensurePurchase("采购演示虚拟卡", { kind: "card", purchaserId: users.finance.id, purchaserName: "王财务", sourceId: cardSource.id, detail: "虚拟卡充值及开卡服务费。", quantity: 0, totalAmount: 640, purchaseDate: today, notes: "" });

  async function ensureAllocation(note, project, rows) {
    const existing = await prisma.resourceAllocation.findFirst({ where: { note } });
    return existing ?? prisma.resourceAllocation.create({ data: { assigneeId: users.production.id, allocatorId: users.resource.id, projectId: project.id, note, items: { create: rows } } });
  }
  await ensureAllocation("演示批次 A：Claude 注册资源", mainProject, [
    { kind: "email", sourceId: fullSource.id, quantity: 1, business: "Claude", emailId: emails[0].id, used: false },
    { kind: "proxy", sourceId: fullSource.id, quantity: 1, proxyId: proxies[0].id, used: false },
    { kind: "card", sourceId: cardSource.id, amount: 180, business: "Claude", cardId: cards[0].id, used: false },
  ]);
  await ensureAllocation("演示批次 B：GPT 补充资源", mainProject, [
    { kind: "email", sourceId: mailSource.id, quantity: 1, business: "GPT", emailId: emails[1].id, used: true },
    { kind: "email", sourceId: mailSource.id, quantity: 1, business: "GPT", emailId: emails[2].id, used: false },
    { kind: "proxy", sourceId: fullSource.id, quantity: 1, proxyId: proxies[1].id, used: true },
    { kind: "card", sourceId: cardSource.id, amount: 120, business: "GPT", cardId: cards[1].id, used: false },
  ]);

  async function ensureBatch(note, data) {
    const existing = await prisma.productionBatch.findFirst({ where: { note } });
    return existing ? prisma.productionBatch.update({ where: { id: existing.id }, data: { status: data.status } }) : prisma.productionBatch.create({ data: { note, ...data } });
  }
  await ensureBatch("演示产出批次：Claude", { projectId: mainProject.id, productId: claudeProduct.id, quantity: 12, batchDate: today, status: "in_use", operatorId: users.production.id, resultData: "sk-ant-demo-001\nsk-ant-demo-002\nsk-ant-demo-003" });
  await ensureBatch("演示产出批次：GPT", { projectId: mainProject.id, productId: gptProduct.id, quantity: 20, batchDate: today, status: "banned", operatorId: users.production.id, resultData: "sk-proj-demo-001\nsk-proj-demo-002\nsk-proj-demo-003" });
  await ensureBatch("演示产出批次：已退款", { projectId: backupProject.id, productId: proxyProduct.id, quantity: 6, batchDate: today, status: "refunded", operatorId: users.production.id, resultData: "refund-demo-001\nrefund-demo-002" });

  console.log("[seed] done");
}

main()
  .catch((e) => {
    console.error("[seed] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
