"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, MoreHorizontal, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import DataState from "@/components/DataState";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecordDetailDialog from "@/components/RecordDetailDialog";
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
import { fmtDate, fmtDay } from "@/lib/format";
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
      <PageHeader title="设置" subtitle="用户与角色 · AI 助手 · 我的账号" />

      <Tabs defaultValue={isAdmin ? "users" : "account"}>
        <TabsList>
          {isAdmin && <TabsTrigger value="users">用户与角色</TabsTrigger>}
          {isAdmin && <TabsTrigger value="ai">AI 助手</TabsTrigger>}
          {isAdmin && <TabsTrigger value="trash">回收站</TabsTrigger>}
          <TabsTrigger value="account">我的账号</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="users" className="mt-4">
            <UsersPanel />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="ai" className="mt-4">
            <AiAssistantPanel />
          </TabsContent>
        )}
        {isAdmin && <TabsContent value="trash" className="mt-4"><RecycleBin /></TabsContent>}

        <TabsContent value="account" className="mt-4">
          <AccountPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}

interface AiConfigItem {
  channel: "custom" | "deepseek" | "openai";
  baseUrl: string;
  model: string;
  enabled: boolean;
  temperature: number;
  apiKeySet: boolean;
  source: string;
  ready: boolean;
}

type AiPresets = Record<
  "deepseek" | "openai",
  { label: string; baseUrl: string; model: string; hint: string }
>;

function AiAssistantPanel() {
  const [channel, setChannel] = useState<"custom" | "deepseek" | "openai">("custom");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [temperature, setTemperature] = useState("0.2");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [presets, setPresets] = useState<AiPresets | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<{ item: AiConfigItem; presets: AiPresets }>("/api/assistant/config");
      const c = r.item;
      setChannel(c.channel);
      setBaseUrl(c.baseUrl);
      setModel(c.model);
      setEnabled(c.enabled);
      setTemperature(String(c.temperature ?? 0.2));
      setApiKeySet(c.apiKeySet);
      setApiKey("");
      setPresets(r.presets);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function applyPreset(key: "deepseek" | "openai") {
    const p = presets?.[key];
    if (!p) return;
    setChannel(key);
    setBaseUrl(p.baseUrl);
    setModel(p.model);
  }

  async function save() {
    if (enabled && !baseUrl.trim()) return toast.warning("请填写 API Base URL");
    if (enabled && !model.trim()) return toast.warning("请填写模型名");
    if (enabled && !apiKeySet && !apiKey.trim()) return toast.warning("请填写 API Key");

    setSaving(true);
    try {
      const ok = await mutate(
        () =>
          api.put("/api/assistant/config", {
            channel,
            baseUrl: baseUrl.trim(),
            model: model.trim(),
            apiKey: apiKey.trim() || undefined,
            enabled,
            temperature: Number(temperature) || 0.2,
          }),
        { success: "AI 配置已保存", error: "保存失败" },
      );
      if (ok) {
        setApiKey("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles size={17} />
          AI 助手接口
        </CardTitle>
        <CardDescription>
          OpenAI 兼容协议。可选 DeepSeek / OpenAI 预设，也可填任意中转的 baseUrl 与模型名。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="启用">
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span className="text-sm text-muted-foreground">
              {enabled ? "已启用" : "关闭时无法使用 AI 记账"}
            </span>
          </div>
        </Field>

        <Field label="渠道预设" hint="选择后自动填充地址与默认模型，仍可手改">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={channel === "deepseek" ? "default" : "outline"}
              onClick={() => applyPreset("deepseek")}
            >
              DeepSeek
            </Button>
            <Button
              type="button"
              size="sm"
              variant={channel === "openai" ? "default" : "outline"}
              onClick={() => applyPreset("openai")}
            >
              OpenAI
            </Button>
            <Button
              type="button"
              size="sm"
              variant={channel === "custom" ? "default" : "outline"}
              onClick={() => setChannel("custom")}
            >
              自定义
            </Button>
          </div>
          {channel !== "custom" && presets?.[channel] && (
            <p className="text-xs text-muted-foreground mt-1">{presets[channel].hint}</p>
          )}
        </Field>

        <Field label="API Base URL" required={enabled} hint="须含 /v1，如 https://api.deepseek.com/v1">
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
          />
        </Field>

        <Field label="模型名" required={enabled} hint="控制台里的 model id，可自由填写">
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-chat / gpt-4o-mini"
          />
        </Field>

        <Field
          label="API Key"
          required={enabled && !apiKeySet}
          hint={apiKeySet ? "已保存密钥；留空表示不修改" : "密钥只存服务端，不会回显"}
        >
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiKeySet ? "••••••••（留空不改）" : "sk-..."}
            autoComplete="off"
          />
        </Field>

        <Field label="Temperature" hint="0~2，记账建议 0.1~0.3">
          <Input
            type="number"
            min={0}
            max={2}
            step="0.1"
            className="w-32"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </Field>

        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存配置
          </Button>
          {apiKeySet && (
            <Button
              variant="outline"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const ok = await mutate(
                    () => api.put("/api/assistant/config", { clearApiKey: true }),
                    { success: "已清除密钥", error: "操作失败" },
                  );
                  if (ok) await load();
                } finally {
                  setSaving(false);
                }
              }}
            >
              清除密钥
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface TrashItem { id: number; entity: string; entityLabel: string; name: string; deletedAt: string }
function RecycleBin() {
  const { items, loading, error, reload } = useList<TrashItem>("/api/trash");
  const [viewing, setViewing] = useState<TrashItem | null>(null);
  return <><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trash2 size={17} />回收站</CardTitle><CardDescription>删除的数据会保留在这里，可随时恢复。</CardDescription></CardHeader><CardContent className="p-0"><DataState loading={loading} error={error} empty={!items.length} emptyText="回收站为空" onRetry={reload}><Table><TableHeader><TableRow><TableHead>类型</TableHead><TableHead>记录</TableHead><TableHead>删除时间</TableHead><TableHead className="w-20" /></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={`${item.entity}-${item.id}`} className="cursor-pointer" onClick={() => setViewing(item)}><TableCell><Badge variant="secondary">{item.entityLabel}</Badge></TableCell><TableCell className="font-medium">{item.name}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{fmtDate(item.deletedAt)}</TableCell><TableCell onClick={(event) => event.stopPropagation()}><Button size="sm" variant="outline" onClick={async () => { const ok = await mutate(() => api.post("/api/trash", { entity: item.entity, id: item.id }), { success: "已恢复", error: "恢复失败" }); if (ok) reload(); }}><RotateCcw size={14} />恢复</Button></TableCell></TableRow>)}</TableBody></Table></DataState></CardContent></Card><RecordDetailDialog open={viewing !== null} onOpenChange={(value) => !value && setViewing(null)} title="删除记录详情" fields={viewing ? [{ label: "类型", value: viewing.entityLabel }, { label: "记录", value: viewing.name }, { label: "原始 ID", value: viewing.id }, { label: "删除时间", value: fmtDate(viewing.deletedAt) }] : []} /></>;
}

function UsersPanel() {
  const session = useSession();
  const { items, loading, error, reload } = useList<ManagedUser>("/api/users");

  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [viewing, setViewing] = useState<ManagedUser | null>(null);

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
                    <TableRow key={u.id} className="cursor-pointer" onClick={() => setViewing(u)}>
                      <TableCell className="font-mono text-xs">{u.username}</TableCell>
                      <TableCell className="font-medium">
                        {u.displayName}
                        {isSelf && (
                          <span className="text-[11px] text-muted-foreground ml-1.5">（我）</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
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
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Switch
                          checked={u.active}
                          disabled={isSelf}
                          onCheckedChange={(v) => patchUser(u, { active: v })}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {fmtDay(u.createdAt)}
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
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
      <RecordDetailDialog open={viewing !== null} onOpenChange={(v) => !v && setViewing(null)} title="用户详情" fields={viewing ? [{ label: "用户名", value: viewing.username }, { label: "姓名", value: viewing.displayName }, { label: "角色", value: ROLE_LABEL[viewing.role] }, { label: "状态", value: viewing.active ? "启用" : "停用" }, { label: "创建时间", value: fmtDay(viewing.createdAt) }, { label: "备注", value: viewing.note, wide: true }] : []} />
      <ResetPasswordDialog
        user={resetting}
        onOpenChange={(v) => !v && setResetting(null)}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`删除用户「${deleting?.displayName ?? ""}」？`}
        description="删除后用户会立即停用并进入回收站，恢复时重新启用。"
        onConfirm={async () => {
          if (!deleting) return;
          const ok = await mutate(() => api.del(`/api/users/${deleting.id}`), {
            success: "已移至回收站",
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
