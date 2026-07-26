import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth";
import { canVisit } from "@/lib/nav";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // API 的角色校验【不在这里做】—— method 级差异 middleware 表达不了
  // (同一路径 GET 允许财务、POST 只允许资源管理员)。统一由每个 handler
  // 的 requireRole() 负责。
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // 页面级角色拦截。权限表来自 src/lib/nav.ts, 与侧边栏同一份数据。
  if (!canVisit(session.role, pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/403";
    url.search = "";
    return NextResponse.rewrite(url); // rewrite 而非 redirect, 保留原 URL
  }

  return NextResponse.next();
}

// 原 matcher 里的 `.*\..*` 会放行【任何路径中带点的 URL】——
// /api/users.json、/desks/a.b 都能绕过整个中间件。这里改成只排除
// 明确的静态资源后缀 + Next 内部路径。
export const config = {
  matcher: [
    "/((?!_next/|favicon\\.ico$|.*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|map|woff2?|ttf)$).*)",
  ],
};
