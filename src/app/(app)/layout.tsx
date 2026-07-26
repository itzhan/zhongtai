import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { RoleProvider } from "@/components/RoleProvider";
import { getSession } from "@/lib/auth";

/// 所有登录后页面的外壳。会话在这里读一次并注入 context, 页面因此不需要
/// 各自 fetch("/api/auth/me")。/login 与 /403 不在本路由组内。
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <RoleProvider value={session}>
      <Shell>{children}</Shell>
    </RoleProvider>
  );
}
