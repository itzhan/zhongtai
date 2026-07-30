"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  Factory,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { isNavGroup, isUnder, navFor, type IconKey, type NavGroup, type NavItem } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useSession } from "./RoleProvider";
import ThemeToggle from "./ThemeToggle";

/// nav.ts 保持纯数据 (middleware 要在 Edge runtime import 它), 图标在这里
/// 才映射成组件。
export const ICONS: Record<IconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  project: FolderKanban,
  product: Package,
  desk: Store,
  supplier: Truck,
  resource: Boxes,
  allocation: ClipboardList,
  production: Factory,
  purchase: ShoppingCart,
  settings: Settings,
};

export function isActive(pathname: string, item: NavItem): boolean {
  return isUnder(pathname, item.match ?? item.href);
}

export function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item);
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 border",
        active
          ? "bg-primary/10 text-primary border-primary/20 dark:bg-primary/15 dark:border-primary/25"
          : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent",
      )}
    >
      <span
        className={cn(
          "transition-colors",
          active ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground",
        )}
      >
        <Icon size={18} />
      </span>
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

export function NavGroupSection({
  entry,
  pathname,
  onNavigate,
}: {
  entry: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="mt-4 first:mt-2">
      <div className="px-3 mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          {entry.group}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {entry.items.map((it) => (
          <NavLink key={it.href} item={it} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const entries = navFor(session.role);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex shrink-0 w-56 h-screen sticky top-0 bg-card border-r border-border flex-col">
      <div className="p-4 pb-3 flex items-center gap-3">
        <Wallet size={24} className="text-primary shrink-0" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight">利润中台</span>
          <span className="text-[11px] text-muted-foreground/60">中转利润管理</span>
        </div>
      </div>

      <Separator className="mx-3 w-auto" />

      <nav className="px-2.5 mt-3 flex flex-col gap-0.5 overflow-y-auto flex-1">
        {entries.map((entry) =>
          isNavGroup(entry) ? (
            <NavGroupSection key={entry.group} entry={entry} pathname={pathname} />
          ) : (
            <NavLink key={entry.href} item={entry} pathname={pathname} />
          ),
        )}
      </nav>

      <div className="mt-auto p-2.5 space-y-2">
        <Separator />
        <div className="px-1.5 flex items-center gap-2 min-w-0">
          <p className="text-[13px] font-medium truncate flex-1">{session.displayName}</p>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
            {ROLE_LABEL[session.role]}
          </Badge>
        </div>
        <div className="flex items-center justify-between px-1">
          <ThemeToggle />
          <button
            onClick={logout}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={14} />
            <span>退出</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
