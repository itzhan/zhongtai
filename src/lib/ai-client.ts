// OpenAI 兼容 Chat Completions (DeepSeek / GPT / 任意中转)

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatCompletionJson(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  timeoutMs?: number;
}): Promise<unknown> {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const url = `${base}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.2,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      let msg = `AI 接口错误 HTTP ${res.status}`;
      try {
        const j = JSON.parse(text) as { error?: { message?: string }; message?: string };
        msg = j.error?.message || j.message || msg;
      } catch {
        if (text) msg = text.slice(0, 200);
      }
      // 部分中转不支持 response_format，重试一次不带该字段
      if (res.status === 400 && text.includes("response_format")) {
        return chatCompletionJsonPlain(opts);
      }
      throw new Error(msg);
    }

    return parseAssistantContent(text);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("AI 请求超时，请检查接口地址与网络");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function chatCompletionJsonPlain(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  timeoutMs?: number;
}): Promise<unknown> {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = `AI 接口错误 HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: { message?: string }; message?: string };
      msg = j.error?.message || j.message || msg;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new Error(msg);
  }
  return parseAssistantContent(text);
}

function parseAssistantContent(rawResponse: string): unknown {
  const data = JSON.parse(rawResponse) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回为空");
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned) as unknown;
}
