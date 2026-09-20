-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
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
);

-- CreateTable
CREATE TABLE "ProjectDemand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "productId" INTEGER,
    "productName" TEXT NOT NULL,
    "sellPrice" REAL NOT NULL DEFAULT 0,
    "spec" TEXT NOT NULL DEFAULT '',
    "quantity" REAL,
    "note" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectDemand_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectDemand_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'cny',
    "channel" TEXT NOT NULL DEFAULT '',
    "fromKind" TEXT NOT NULL DEFAULT '',
    "fromId" INTEGER,
    "fromName" TEXT NOT NULL DEFAULT '',
    "toKind" TEXT NOT NULL DEFAULT '',
    "toId" INTEGER,
    "toName" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "entryDate" TEXT NOT NULL,
    "costSource" TEXT NOT NULL DEFAULT 'self',
    "supplierId" INTEGER,
    "createdById" INTEGER,
    "creatorName" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinanceEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinanceEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompanyFund" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "holder" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'cny',
    "amount" REAL NOT NULL DEFAULT 0,
    "uncertain" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "capacity" TEXT,
    "projectId" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Desk" (
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
    CONSTRAINT "Desk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeskProject" (
    "deskId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("deskId", "projectId"),
    CONSTRAINT "DeskProject_deskId_fkey" FOREIGN KEY ("deskId") REFERENCES "Desk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeskProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeskItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deskId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL DEFAULT '',
    "quantity" REAL NOT NULL DEFAULT 0,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeskItem_deskId_fkey" FOREIGN KEY ("deskId") REFERENCES "Desk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeskItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
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
    CONSTRAINT "Supplier_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierGood" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supplierId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rate" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierGood_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supplierId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" INTEGER,
    "creatorName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierComment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sub2Site" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "hysteresis" INTEGER NOT NULL DEFAULT 2,
    "escalateAfterMin" INTEGER NOT NULL DEFAULT 3,
    "loadFactorStep" INTEGER NOT NULL DEFAULT 10,
    "maxLoadFactor" INTEGER NOT NULL DEFAULT 100,
    "concurrencyStep" INTEGER NOT NULL DEFAULT 5,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "ownerName" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT NOT NULL DEFAULT '',
    "sub2SiteId" INTEGER,
    "sub2UserId" INTEGER,
    "sub2UserName" TEXT NOT NULL DEFAULT '',
    "sub2UserEmail" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Customer_sub2SiteId_fkey" FOREIGN KEY ("sub2SiteId") REFERENCES "Sub2Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerResource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT '',
    "sellMode" TEXT NOT NULL DEFAULT 'discount',
    "discount" REAL NOT NULL DEFAULT 1,
    "fxRate" REAL NOT NULL DEFAULT 6.75,
    "sellUnitPrice" REAL NOT NULL DEFAULT 0,
    "costMode" TEXT NOT NULL DEFAULT 'api',
    "costFixedAmount" REAL NOT NULL DEFAULT 0,
    "costUnitPrice" REAL NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerResource_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierMonitor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supplierId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT '默认',
    "kind" TEXT NOT NULL DEFAULT 'openai',
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "slowMs" INTEGER NOT NULL DEFAULT 5000,
    "sub2ChannelId" INTEGER,
    "sub2SiteId" INTEGER,
    "sub2AccountId" INTEGER,
    "lastDispatchGrade" TEXT NOT NULL DEFAULT '',
    "dispatchGradeStreak" INTEGER NOT NULL DEFAULT 0,
    "originPriority" INTEGER,
    "originConcurrency" INTEGER,
    "originLoadFactor" INTEGER,
    "lastStatus" TEXT NOT NULL DEFAULT 'unknown',
    "lastLatencyMs" INTEGER,
    "lastError" TEXT NOT NULL DEFAULT '',
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierMonitor_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierMonitor_sub2SiteId_fkey" FOREIGN KEY ("sub2SiteId") REFERENCES "Sub2Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sub2DispatchLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "monitorId" INTEGER,
    "accountId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT '',
    "concurrency" INTEGER,
    "currentInUse" INTEGER,
    "detail" TEXT NOT NULL DEFAULT '',
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sub2DispatchLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Sub2Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sub2DispatchLog_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "SupplierMonitor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierMonitorSample" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "monitorId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "httpStatus" INTEGER,
    "error" TEXT NOT NULL DEFAULT '',
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierMonitorSample_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "SupplierMonitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supplierId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "quantity" REAL NOT NULL DEFAULT 0,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourceSource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT '',
    "kinds" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "emailPrice" REAL NOT NULL DEFAULT 0,
    "proxyPrice" REAL NOT NULL DEFAULT 0,
    "cardPrice" REAL NOT NULL DEFAULT 0,
    "priceInfo" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CardResource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "cardNo" TEXT NOT NULL,
    "cvv" TEXT NOT NULL DEFAULT '',
    "expiry" TEXT NOT NULL DEFAULT '',
    "holder" TEXT NOT NULL DEFAULT '',
    "amount" REAL NOT NULL DEFAULT 0,
    "usage" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'available',
    "projectId" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "usedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CardResource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResourceSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CardResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProxyResource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "protocol" TEXT NOT NULL DEFAULT 'socks',
    "ipType" TEXT NOT NULL DEFAULT 'static',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "rotateUrl" TEXT NOT NULL DEFAULT '',
    "expiresAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'available',
    "projectId" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProxyResource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResourceSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProxyResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailResource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "providerKey" TEXT NOT NULL DEFAULT 'mock',
    "address" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '',
    "recoveryInfo" TEXT NOT NULL DEFAULT '',
    "usage" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'available',
    "projectId" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmailResource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResourceSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailProviderConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "providerKey" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiProviderConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL DEFAULT 'default',
    "channel" TEXT NOT NULL DEFAULT 'custom',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "temperature" REAL NOT NULL DEFAULT 0.2,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ResourceBusiness" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ResourceAllocation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assigneeId" INTEGER NOT NULL,
    "allocatorId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "allocatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResourceAllocation_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResourceAllocation_allocatorId_fkey" FOREIGN KEY ("allocatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResourceAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourceAllocationItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "allocationId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL DEFAULT 0,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "business" TEXT NOT NULL DEFAULT '',
    "emailId" INTEGER,
    "proxyId" INTEGER,
    "cardId" INTEGER,
    CONSTRAINT "ResourceAllocationItem_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "ResourceAllocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResourceAllocationItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResourceSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResourceAllocationItem_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "EmailResource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResourceAllocationItem_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "ProxyResource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResourceAllocationItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CardResource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourceRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "periodDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT NOT NULL DEFAULT '',
    "handledById" INTEGER,
    "handledAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResourceRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResourceRequest_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResourceRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourceRequestItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requestId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ResourceRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ResourceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResourceRequestItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResourceSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER,
    "requestId" INTEGER,
    "kind" TEXT NOT NULL,
    "purchaserId" INTEGER NOT NULL,
    "purchaserName" TEXT NOT NULL DEFAULT '',
    "sourceId" INTEGER,
    "content" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "purchaseDate" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Purchase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Purchase_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ResourceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Purchase_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Purchase_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ResourceSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "batchDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_use',
    "operatorId" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "resultData" TEXT NOT NULL DEFAULT '',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "ProjectDemand_projectId_idx" ON "ProjectDemand"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDemand_productId_idx" ON "ProjectDemand"("productId");

-- CreateIndex
CREATE INDEX "ProjectDemand_sortOrder_idx" ON "ProjectDemand"("sortOrder");

-- CreateIndex
CREATE INDEX "FinanceEntry_projectId_idx" ON "FinanceEntry"("projectId");

-- CreateIndex
CREATE INDEX "FinanceEntry_kind_idx" ON "FinanceEntry"("kind");

-- CreateIndex
CREATE INDEX "FinanceEntry_entryDate_idx" ON "FinanceEntry"("entryDate");

-- CreateIndex
CREATE INDEX "FinanceEntry_createdById_idx" ON "FinanceEntry"("createdById");

-- CreateIndex
CREATE INDEX "FinanceEntry_supplierId_idx" ON "FinanceEntry"("supplierId");

-- CreateIndex
CREATE INDEX "FinanceEntry_fromKind_fromId_idx" ON "FinanceEntry"("fromKind", "fromId");

-- CreateIndex
CREATE INDEX "FinanceEntry_toKind_toId_idx" ON "FinanceEntry"("toKind", "toId");

-- CreateIndex
CREATE INDEX "TeamMember_active_idx" ON "TeamMember"("active");

-- CreateIndex
CREATE INDEX "CompanyFund_kind_idx" ON "CompanyFund"("kind");

-- CreateIndex
CREATE INDEX "CompanyFund_holder_idx" ON "CompanyFund"("holder");

-- CreateIndex
CREATE INDEX "Product_projectId_idx" ON "Product"("projectId");

-- CreateIndex
CREATE INDEX "Product_sortOrder_idx" ON "Product"("sortOrder");

-- CreateIndex
CREATE INDEX "Desk_ownerId_idx" ON "Desk"("ownerId");

-- CreateIndex
CREATE INDEX "Desk_status_idx" ON "Desk"("status");

-- CreateIndex
CREATE INDEX "Desk_apiKind_idx" ON "Desk"("apiKind");

-- CreateIndex
CREATE INDEX "DeskProject_projectId_idx" ON "DeskProject"("projectId");

-- CreateIndex
CREATE INDEX "DeskItem_deskId_idx" ON "DeskItem"("deskId");

-- CreateIndex
CREATE INDEX "DeskItem_productId_idx" ON "DeskItem"("productId");

-- CreateIndex
CREATE INDEX "Supplier_ownerId_idx" ON "Supplier"("ownerId");

-- CreateIndex
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");

-- CreateIndex
CREATE INDEX "SupplierGood_supplierId_idx" ON "SupplierGood"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierComment_supplierId_idx" ON "SupplierComment"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierComment_createdById_idx" ON "SupplierComment"("createdById");

-- CreateIndex
CREATE INDEX "Customer_ownerId_idx" ON "Customer"("ownerId");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE INDEX "Customer_sub2SiteId_idx" ON "Customer"("sub2SiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_sub2SiteId_sub2UserId_key" ON "Customer"("sub2SiteId", "sub2UserId");

-- CreateIndex
CREATE INDEX "CustomerResource_customerId_idx" ON "CustomerResource"("customerId");

-- CreateIndex
CREATE INDEX "SupplierMonitor_supplierId_idx" ON "SupplierMonitor"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierMonitor_sub2SiteId_idx" ON "SupplierMonitor"("sub2SiteId");

-- CreateIndex
CREATE INDEX "Sub2DispatchLog_siteId_createdAt_idx" ON "Sub2DispatchLog"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "Sub2DispatchLog_monitorId_idx" ON "Sub2DispatchLog"("monitorId");

-- CreateIndex
CREATE INDEX "SupplierMonitorSample_monitorId_checkedAt_idx" ON "SupplierMonitorSample"("monitorId", "checkedAt");

-- CreateIndex
CREATE INDEX "SupplierItem_supplierId_idx" ON "SupplierItem"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierItem_productId_idx" ON "SupplierItem"("productId");

-- CreateIndex
CREATE INDEX "ResourceSource_active_idx" ON "ResourceSource"("active");

-- CreateIndex
CREATE INDEX "CardResource_sourceId_idx" ON "CardResource"("sourceId");

-- CreateIndex
CREATE INDEX "CardResource_status_idx" ON "CardResource"("status");

-- CreateIndex
CREATE INDEX "CardResource_projectId_idx" ON "CardResource"("projectId");

-- CreateIndex
CREATE INDEX "ProxyResource_sourceId_idx" ON "ProxyResource"("sourceId");

-- CreateIndex
CREATE INDEX "ProxyResource_protocol_ipType_idx" ON "ProxyResource"("protocol", "ipType");

-- CreateIndex
CREATE INDEX "ProxyResource_status_idx" ON "ProxyResource"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailResource_address_key" ON "EmailResource"("address");

-- CreateIndex
CREATE INDEX "EmailResource_sourceId_idx" ON "EmailResource"("sourceId");

-- CreateIndex
CREATE INDEX "EmailResource_providerKey_idx" ON "EmailResource"("providerKey");

-- CreateIndex
CREATE INDEX "EmailResource_status_idx" ON "EmailResource"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailProviderConfig_providerKey_key" ON "EmailProviderConfig"("providerKey");

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderConfig_key_key" ON "AiProviderConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceBusiness_name_key" ON "ResourceBusiness"("name");

-- CreateIndex
CREATE INDEX "ResourceBusiness_active_sortOrder_idx" ON "ResourceBusiness"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "ResourceAllocation_assigneeId_idx" ON "ResourceAllocation"("assigneeId");

-- CreateIndex
CREATE INDEX "ResourceAllocation_allocatorId_idx" ON "ResourceAllocation"("allocatorId");

-- CreateIndex
CREATE INDEX "ResourceAllocation_projectId_idx" ON "ResourceAllocation"("projectId");

-- CreateIndex
CREATE INDEX "ResourceAllocation_allocatedAt_idx" ON "ResourceAllocation"("allocatedAt");

-- CreateIndex
CREATE INDEX "ResourceAllocationItem_allocationId_idx" ON "ResourceAllocationItem"("allocationId");

-- CreateIndex
CREATE INDEX "ResourceAllocationItem_kind_idx" ON "ResourceAllocationItem"("kind");

-- CreateIndex
CREATE INDEX "ResourceAllocationItem_sourceId_idx" ON "ResourceAllocationItem"("sourceId");

-- CreateIndex
CREATE INDEX "ResourceAllocationItem_emailId_idx" ON "ResourceAllocationItem"("emailId");

-- CreateIndex
CREATE INDEX "ResourceAllocationItem_proxyId_idx" ON "ResourceAllocationItem"("proxyId");

-- CreateIndex
CREATE INDEX "ResourceAllocationItem_cardId_idx" ON "ResourceAllocationItem"("cardId");

-- CreateIndex
CREATE INDEX "ResourceRequest_projectId_idx" ON "ResourceRequest"("projectId");

-- CreateIndex
CREATE INDEX "ResourceRequest_reporterId_idx" ON "ResourceRequest"("reporterId");

-- CreateIndex
CREATE INDEX "ResourceRequest_status_idx" ON "ResourceRequest"("status");

-- CreateIndex
CREATE INDEX "ResourceRequest_periodDate_idx" ON "ResourceRequest"("periodDate");

-- CreateIndex
CREATE INDEX "ResourceRequestItem_requestId_idx" ON "ResourceRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "ResourceRequestItem_kind_idx" ON "ResourceRequestItem"("kind");

-- CreateIndex
CREATE INDEX "Purchase_projectId_idx" ON "Purchase"("projectId");

-- CreateIndex
CREATE INDEX "Purchase_requestId_idx" ON "Purchase"("requestId");

-- CreateIndex
CREATE INDEX "Purchase_kind_idx" ON "Purchase"("kind");

-- CreateIndex
CREATE INDEX "Purchase_purchaseDate_idx" ON "Purchase"("purchaseDate");

-- CreateIndex
CREATE INDEX "ProductionBatch_projectId_idx" ON "ProductionBatch"("projectId");

-- CreateIndex
CREATE INDEX "ProductionBatch_productId_idx" ON "ProductionBatch"("productId");

-- CreateIndex
CREATE INDEX "ProductionBatch_batchDate_idx" ON "ProductionBatch"("batchDate");

-- CreateIndex
CREATE INDEX "ProductionBatch_operatorId_idx" ON "ProductionBatch"("operatorId");

