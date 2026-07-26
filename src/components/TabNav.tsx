"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isUnder, tabsFor } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useRole } from "./RoleProvider";

/// 路由式 tab 条 —— 复用 ui/tabs 的视觉, 但底层是 Link, 所以每个 tab 都
/// 能深链、能单独 code-split。
///
/// tab 列表不在这里维护, 而是按当前路径从 src/lib/nav.ts 的 sub 推导,
/// 并自动按角色过滤 —— 侧边栏、路由鉴权、tab 条三者共用同一份数据。
export default function TabNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const role = useRole();
  const items = tabsFor(role, pathname);

  if (items.length <= 1) return null;

  return (
    <nav
      className={cn(
        "inline-flex h-10 items-center rounded-xl bg-card border border-border shadow-sm p-1 max-w-full overflow-x-auto",
        className,
      )}
    >
      {items.map((t) => {
        const active = isUnder(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
