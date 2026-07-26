"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { flatNavFor, isNavGroup, navFor } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/rbac";
import { isActive, NavGroupSection, NavLink } from "./Sidebar";
import { useSession } from "./RoleProvider";
import ThemeToggle from "./ThemeToggle";

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const [open, setOpen] = useState(false);

  const entries = navFor(session.role);
  const current = flatNavFor(session.role).find((it) => isActive(pathname, it));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const close = () => setOpen(false);

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-3 h-12 bg-card/95 backdrop-blur border-b border-border">
        <Button variant="ghost" size="icon-sm" aria-label="菜单" onClick={() => setOpen(true)}>
          <Menu size={18} />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <Wallet size={20} className="text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">{current?.label ?? "利润中台"}</span>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0 flex flex-col">
          <SheetHeader className="flex-row items-center gap-3 p-4 pb-3 space-y-0">
            <Wallet size={24} className="text-primary shrink-0" />
            <div className="flex flex-col leading-tight">
              <SheetTitle className="text-sm font-bold">利润中台</SheetTitle>
              <span className="text-[11px] text-muted-foreground/60">中转利润管理</span>
            </div>
          </SheetHeader>
          <Separator className="mx-4 w-auto" />

          <div className="px-2.5 py-3 flex-1 overflow-y-auto">
            <nav className="flex flex-col gap-0.5">
              {entries.map((entry) =>
                isNavGroup(entry) ? (
                  <NavGroupSection
                    key={entry.group}
                    entry={entry}
                    pathname={pathname}
                    onNavigate={close}
                  />
                ) : (
                  <NavLink
                    key={entry.href}
                    item={entry}
                    pathname={pathname}
                    onNavigate={close}
                  />
                ),
              )}
            </nav>
          </div>

          <Separator />
          <div className="p-2.5 space-y-2">
            <div className="px-1.5">
              <p className="text-[13px] font-medium truncate">{session.displayName}</p>
              <span className="text-[11px] text-muted-foreground/60">
                {ROLE_LABEL[session.role]}
              </span>
            </div>
            <div className="flex items-center justify-between px-1">
              <ThemeToggle />
              <button
                onClick={() => {
                  close();
                  logout();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut size={14} />
                <span>退出</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
