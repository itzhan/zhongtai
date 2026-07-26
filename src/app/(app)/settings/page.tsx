"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, MoreHorizontal, Plus } from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import { useSession } from "@/components/RoleProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { api, mutate } from "@/lib/api-client";
import { fmtDay } from "@/lib/format";
import { ALL_ROLES, ROLE_LABEL, ROLES, type Role } from "@/lib/rbac";

interface ManagedUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  note: string;
  createdAt: string;
}

export default function SettingsPage() {
  const session = useSession();
  const isAdmin = session.role === ROLES.ADMIN;

  return (
    <>
      <PageHeader title="设置" subtitle="用户与角色 · 我的账号" />

      <Tabs defaultValue={isAdmin ? "users" : "account"}>
        <TabsList>
          {isAdmin && <TabsTrigger value="users">用户与角色</TabsTrigger>}
          <TabsTrigger value="account">我的账号</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="users" className="mt-4">
            <UsersPanel />
          </TabsContent>
        )}

        <TabsContent value="account" className="mt-4">
          <AccountPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}

function UsersPanel() {
  const session = useSession();
  const { items, loading, error, reload } = useList<ManagedUser>("/api/users");

  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);

  async function patchUser(u: ManagedUser, data: Partial<ManagedUser>) {
    const ok = await mutate(() => api.patch(`/api/users/${u.id}`, data), {
      success: "已更新",
      error: "更新失败",
    });
    if (ok) reload();
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button className="rounded-full" onClick={() => setOpen(true)}>
          <Plus size={14} />
          新增用户
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={loading}
            error={error}
            empty={items.length === 0}
            emptyText="还没有用户"
            onRetry={reload}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>启用</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((u) => {
                  const isSelf = u.id === session.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">{u.username}</TableCell>
                      <TableCell className="font-medium">
                        {u.displayName}
                        {isSelf && (
                          <span className="text-[11px] text-muted-foreground ml-1.5">（我）</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* 角色用下拉直改, 不必进编辑弹窗 */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild disabled={isSelf}>
                            <button className="disabled:cursor-default">
                              <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                                {ROLE_LABEL[u.role]}
                              </Badge>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {ALL_ROLES.map((r) => (
                              <DropdownMenuItem
                                key={r}
                                onClick={() => r !== u.role && patchUser(u, { role: r })}
                              >
                                {ROLE_LABEL[r]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.active}
                          disabled={isSelf}
                          onCheckedChange={(v) => patchUser(u, { active: v })}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {fmtDay(u.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="更多">
                              <MoreHorizontal size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setResetting(u)}>
                              <KeyRound size={14} />
                              重置密码
                            </DropdownMenuItem>
                            {!isSelf && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleting(u)}
                              >
                                删除
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      <NewUserDialog open={open} onOpenChange={setOpen} onSaved={reload} />
      <ResetPasswordDialog
        user={resetting}
        onOpenChange={(v) => !v && setResetting(null)}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除用户「${deleting?.displayName ?? ""}」？`}
        description="已关联业务数据的用户删不掉，请改用「停用」。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/users/${deleting.id}`), {
            success: "已删除",
            error: "删除失败",
          });
          setDeleting(null);
          if (ok) reload();
        }}
      />
    </>
  );
}

function NewUserDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("sales");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername("");
    setDisplayName("");
    setPassword("");
    setRole("sales");
  }, [open]);

  async function save() {
    if (!username.trim()) return toast.warning("请填写用户名");
    if (!displayName.trim()) return toast.warning("请填写姓名");
    if (password.length < 6) return toast.warning("密码至少 6 位");

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          api.post("/api/users", {
            username: username.trim(),
            displayName: displayName.trim(),
            password,
            role,
          }),
        { success: "已创建", error: "创建失败" },
      );
      if (ok) {
        onOpenChange(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>新增用户</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="用户名" required hint="登录用，英文数字">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="姓名" required>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
          </div>

          <Field label="初始密码" required hint="至少 6 位">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Field label="角色" required>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onOpenChange,
  onSaved,
}: {
  user: ManagedUser | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setPassword("");
  }, [user]);

  async function save() {
    if (!user) return;
    if (password.length < 6) return toast.warning("密码至少 6 位");

    setSaving(true);
    try {
      const ok = await mutate(() => api.patch(`/api/users/${user.id}`, { password }), {
        success: "密码已重置",
        error: "重置失败",
      });
      if (ok) {
        onOpenChange(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>重置「{user?.displayName}」的密码</DialogTitle>
        </DialogHeader>

        <Field label="新密码" required hint="至少 6 位">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            重置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountPanel() {
  const session = useSession();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (newPassword.length < 6) return toast.warning("新密码至少 6 位");
    if (newPassword !== confirm) return toast.warning("两次输入的新密码不一致");

    setSaving(true);
    try {
      const ok = await mutate(
        () => api.post("/api/auth/change-password", { oldPassword, newPassword }),
        { success: "密码已修改", error: "修改失败" },
      );
      if (ok) {
        setOldPassword("");
        setNewPassword("");
        setConfirm("");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{session.displayName}</CardTitle>
        <CardDescription>
          {session.username} · {ROLE_LABEL[session.role]}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="原密码" required>
          <Input
            type="password"
            autoComplete="current-password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </Field>
        <Field label="新密码" required hint="至少 6 位">
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>
        <Field label="确认新密码" required>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          修改密码
        </Button>
      </CardContent>
    </Card>
  );
}
