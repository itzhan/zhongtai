import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/// middleware 在越权时 rewrite 到这里 (而非 redirect, 以保留原 URL)。
/// 本页不在 nav.ts 的权限表内, 所以任何已登录用户都能渲染它, 不会死循环。
export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
        <ShieldAlert size={24} />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">无权访问</h1>
        <p className="text-sm text-muted-foreground">
          当前角色没有这个页面的权限。如果你认为这是配置问题，请联系管理员。
        </p>
      </div>
      <Button asChild variant="secondary" className="rounded-full">
        <Link href="/">返回仪表盘</Link>
      </Button>
    </div>
  );
}
