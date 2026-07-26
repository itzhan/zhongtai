import type { ProxyIpType, ProxyProtocol, ResourceStatus } from "@/lib/enums";

interface Base {
  id: number;
  sourceId: number | null;
  status: ResourceStatus;
  projectId: number | null;
  notes: string;
  source: { id: number; name: string } | null;
  project: { id: number; code: string; name: string } | null;
}

export interface CardResource extends Base {
  /// 脱敏字段: 只有资源管理员看得到明文
  cardNo: string | null;
  cvv: string | null;
  expiry: string;
  holder: string;
  /// 脱敏字段: 生产看不到
  amount: number | null;
  usage: string;
  usedAt: string | null;
}

export interface ProxyResource extends Base {
  protocol: ProxyProtocol;
  ipType: ProxyIpType;
  host: string;
  port: number;
  username: string;
  /// 脱敏字段: 销售/财务看不到
  password: string | null;
  region: string;
  rotateUrl: string;
  expiresAt: string | null;
}

export interface EmailResource extends Base {
  providerKey: string;
  address: string;
  /// 脱敏字段
  password: string | null;
  recoveryInfo: string;
}

export interface ResourceSource {
  id: number;
  name: string;
  channel: string;
  /// 逗号分隔的 email/proxy/card
  kinds: string;
  contact: string;
  /// 以下四个是脱敏字段
  emailPrice: number | null;
  proxyPrice: number | null;
  cardPrice: number | null;
  priceInfo: string | null;
  active: boolean;
  notes: string;
  _count: { cards: number; proxies: number; emails: number };
}

export interface MailProviderInfo {
  key: string;
  label: string;
  enabled: boolean;
  configFields: { name: string; label: string; secret?: boolean; placeholder?: string }[];
  config: Record<string, string>;
}

export interface MailMessage {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  snippet: string;
  body?: string;
  code?: string | null;
}
