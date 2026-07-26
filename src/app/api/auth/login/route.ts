import { NextResponse } from "next/server";
import { authenticate, issueToken, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<{
    username: string;
    password: string;
  }>;

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "请输入用户名和密码" }, { status: 400 });
  }

  const session = await authenticate(username, password);
  if (!session) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  await setSessionCookie(await issueToken(session));
  return NextResponse.json({ item: session });
}
