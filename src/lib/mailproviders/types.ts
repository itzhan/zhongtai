// 接码 provider 的接口契约。
//
// 这个文件不含任何 provider 实现, 也没有副作用, 所以前端可以安全 import
// 里面的类型。

/// 一封收件箱邮件的统一形状 —— 所有 provider 必须归一到这个结构,
/// 前端只认这一种, 换 provider 不动 UI。
export interface MailMessage {
  id: string;
  from: string;
  subject: string;
  /// ISO 8601 字符串, 前端用 fmtDate 渲染
  receivedAt: string;
  snippet: string;
  body?: string;
  /// 从正文/标题里抽出的验证码; 抽不到给 null
  code?: string | null;
}

/// provider 需要的配置项声明 —— 前端据此自动渲染配置表单, 所以加新
/// provider 不用改配置页面。
export interface ProviderConfigField {
  name: string;
  label: string;
  /// true 表示密文, GET /api/mail-providers 不回传实际值
  secret?: boolean;
  placeholder?: string;
}

/// 拉取时传给 provider 的上下文。config 来自 EmailProviderConfig.configJson。
export interface MailProviderContext {
  address: string;
  password: string;
  config: Record<string, unknown>;
}

export interface MailProvider {
  /// 唯一 key, 对应 EmailResource.providerKey 与 EmailProviderConfig.providerKey
  key: string;
  label: string;
  configFields: ProviderConfigField[];
  fetchInbox(ctx: MailProviderContext, opts?: { limit?: number }): Promise<MailMessage[]>;
}

/// 从文本里抽 4-8 位数字验证码。各 provider 可以直接复用。
export function extractCode(text: string): string | null {
  const m = text.match(/(?<!\d)(\d{4,8})(?!\d)/);
  return m ? m[1] : null;
}
