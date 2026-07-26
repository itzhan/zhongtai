import { registerProvider } from "./registry";
import { extractCode, type MailProvider } from "./types";

/// 本期唯一实现 —— 不打任何外部 API, 生成可预期的假邮件, 用来跑通
/// 「邮箱列表 → 一键获取收件箱 → 前端展示验证码」全链路。
///
/// 接真实服务时照抄这个文件的结构即可: 实现 fetchInbox, 在文件末尾
/// registerProvider, 再去 index.ts 加一行 import。
const mock: MailProvider = {
  key: "mock",
  label: "Mock（测试用）",
  configFields: [
    { name: "apiBase", label: "API 地址", placeholder: "https://example.com" },
    { name: "apiKey", label: "API Key", secret: true },
  ],

  async fetchInbox(ctx, opts) {
    const limit = opts?.limit ?? 5;
    const now = Date.now();

    return Array.from({ length: limit }, (_, i) => {
      const code = String(100000 + (Math.floor(now / 1000) + i * 137) % 900000);
      const body = `您的验证码是 ${code}，5 分钟内有效。`;
      return {
        id: `mock-${now}-${i}`,
        from: `no-reply@service-${i + 1}.test`,
        subject: `【测试】${ctx.address} 的验证码`,
        receivedAt: new Date(now - i * 60_000).toISOString(),
        snippet: body.slice(0, 40),
        body,
        code: extractCode(body),
      };
    });
  },
};

registerProvider(mock);

export default mock;
