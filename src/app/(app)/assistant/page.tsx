"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eraser, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useProjectOptions, useSupplierOptions } from "@/hooks/use-options";
import { COST_SOURCE, COST_SOURCE_LABEL, type CostSource } from "@/lib/enums";
import { api } from "@/lib/api-client";
import {
  FINANCE_KIND,
  FINANCE_KIND_LABEL,
  type FinanceKind,
} from "@/lib/enums";
import { todayStr } from "@/lib/format";

interface ActionItem {
  id: string;
  label: string;
  description: string;
  template: string;
}

interface PublicCfg {
  ready: boolean;
  model: string;
}

interface ParseResult {
  action: string;
  reply: string;
  items: Record<string, unknown>[];
  unresolved: string[];
}

export default function AssistantPage() {
  const projects = useProjectOptions(true);
  const suppliers = useSupplierOptions(true);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [actionId, setActionId] = useState("");
  const [message, setMessage] = useState("");
  const [cfg, setCfg] = useState<PublicCfg | null>(null);
  const [reply, setReply] = useState("");
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);

  const current = useMemo(
    () => actions.find((a) => a.id === actionId) ?? null,
    [actions, actionId],
  );

  const loadActions = useCallback(async () => {
    try {
      const r = await api.get<{ items: ActionItem[] }>("/api/assistant/actions");
      setActions(r.items ?? []);
      if (r.items?.length) {
        setActionId((prev) => prev || r.items[0].id);
        setMessage((prev) => (prev ? prev : r.items[0].template));
      }
    } catch {
      setActions([]);
    }
  }, []);

  useEffect(() => {
    loadActions();
    api
      .get<{ item: PublicCfg }>("/api/assistant/config")
      .then((r) => setCfg(r.item))
      .catch(() => setCfg({ ready: true, model: "" }));
  }, [loadActions]);

  // 切换操作时载入对应模板（覆盖输入框）
  function selectAction(id: string) {
    setActionId(id);
    const a = actions.find((x) => x.id === id);
    if (a) {
      setMessage(a.template);
      setItems([]);
      setReply("");
      setUnresolved([]);
    }
  }

  function restoreTemplate() {
    if (current) {
      setMessage(current.template);
      toast.message("已恢复默认模板");
    }
  }

  function clearMessage() {
    setMessage("");
  }

  async function parse() {
    if (!actionId) return toast.warning("请选择操作类型");
    if (!message.trim()) return toast.warning("请输入内容");
    setParsing(true);
    setReply("");
    setUnresolved([]);
    setItems([]);
    try {
      const res = await api.post<{ item: ParseResult }>("/api/assistant/parse", {
        action: actionId,
        message: message.trim(),
      });
      setReply(res.item.reply || "");
      setUnresolved(res.item.unresolved || []);
      setItems(res.item.items || []);
      if (!res.item.items?.length) toast.message("没有解析出可执行的记录");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "解析失败");
    } finally {
      setParsing(false);
    }
  }

  async function apply() {
    if (!items.length) return;
    setApplying(true);
    try {
      const res = await api.post<{
        ok: number;
        failed: number;
        errors: { index: number; error: string }[];
      }>("/api/assistant/apply", { action: actionId, items });
      if (res.ok > 0) {
        toast.success(`已执行 ${res.ok} 条`);
        setItems([]);
        setReply("");
        setUnresolved([]);
      }
      if (res.failed > 0) {
        toast.error(
          res.errors.map((e) => `第 ${e.index + 1} 条: ${e.error}`).join("；") || "部分失败",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "执行失败");
    } finally {
      setApplying(false);
    }
  }

  function updateItem(index: number, patch: Record<string, unknown>) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
  }

  return (
    <>
      <PageHeader
        title="AI 助手"
        subtitle="选择操作类型，用模板或自由文本描述，确认后执行"
        actions={
          <Badge variant="secondary" className="font-normal">
            <Sparkles size={12} className="mr-1" />
            {cfg?.model ? `模型 ${cfg.model}` : cfg?.ready === false ? "未配置 AI" : "AI 助手"}
          </Badge>
        }
      />

      {cfg?.ready === false && (
        <Card className="mb-4 border-warning/40">
          <CardContent className="py-4 text-sm text-muted-foreground">
            尚未配置 AI 接口。请管理员到{" "}
            <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
              设置 → AI 助手
            </Link>{" "}
            填写 DeepSeek / GPT 等兼容接口。
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. 选择本次操作</CardTitle>
          <CardDescription>切换操作会载入对应通用模板，可改可删后自己写</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={actionId} onValueChange={selectAction}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="选择操作" />
            </SelectTrigger>
            <SelectContent>
              {actions.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && (
            <p className="text-sm text-muted-foreground">{current.description}</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-2 flex-row items-start justify-between space-y-0 gap-3">
          <div>
            <CardTitle className="text-base">2. 填写内容</CardTitle>
            <CardDescription>默认是通用模板；可「清空」后自由写，或「恢复模板」</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={restoreTemplate}>
              <RotateCcw size={14} />
              恢复模板
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clearMessage}>
              <Eraser size={14} />
              清空
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={12}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="选择操作后会显示模板，或自行填写…"
            className="font-mono text-sm"
          />
          <Button onClick={parse} disabled={parsing || !message.trim() || !actionId}>
            {parsing && <Loader2 className="h-4 w-4 animate-spin" />}
            解析
          </Button>
          {reply && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap border-t pt-3">
              {reply}
            </p>
          )}
          {unresolved.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
              <p className="font-medium mb-1">未能自动处理</p>
              <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                {unresolved.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">3. 确认并执行</CardTitle>
            <CardDescription>可改草稿；确认后才会写入数据库</CardDescription>
          </div>
          <Button onClick={apply} disabled={!items.length || applying}>
            {applying && <Loader2 className="h-4 w-4 animate-spin" />}
            确认执行（{items.length}）
          </Button>
        </CardHeader>
        <CardContent className="p-0 border-t">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">解析后在此预览</p>
          ) : (
            <DraftTable
              actionId={actionId}
              items={items}
              projects={projects}
              suppliers={suppliers}
              onChange={updateItem}
              onRemove={removeItem}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function DraftTable({
  actionId,
  items,
  projects,
  suppliers,
  onChange,
  onRemove,
}: {
  actionId: string;
  items: Record<string, unknown>[];
  projects: { id: number; name: string }[];
  suppliers: { id: number; name: string }[];
  onChange: (index: number, patch: Record<string, unknown>) => void;
  onRemove: (index: number) => void;
}) {
  if (actionId === "bookkeep") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>项目</TableHead>
            <TableHead>方向</TableHead>
            <TableHead>来源</TableHead>
            <TableHead>金额</TableHead>
            <TableHead>日期</TableHead>
            <TableHead>说明</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((d, i) => (
            <TableRow key={i}>
              <TableCell className="min-w-[140px]">
                <Select
                  value={String(d.projectId ?? "")}
                  onValueChange={(v) => onChange(i, { projectId: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={String(d.kind ?? "cost")}
                  onValueChange={(v) => onChange(i, { kind: v as FinanceKind, ...(v === "income" ? { costSource: "self", supplierId: null } : {}) })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCE_KIND.map((k) => (
                      <SelectItem key={k} value={k}>
                        {FINANCE_KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="min-w-[160px]">
                {d.kind === "cost" ? (
                  <div className="flex gap-1">
                    <Select
                      value={String(d.costSource ?? "self")}
                      onValueChange={(v) => onChange(i, { costSource: v as CostSource, ...(v === "self" ? { supplierId: null } : {}) })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COST_SOURCE.map((s) => (
                          <SelectItem key={s} value={s}>
                            {COST_SOURCE_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {d.costSource === "supplier" && (
                      <Select
                        value={d.supplierId ? String(d.supplierId) : ""}
                        onValueChange={(v) => onChange(i, { supplierId: Number(v) })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="供货方" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  className="w-28 tabular-nums"
                  value={String(d.amount ?? "")}
                  onChange={(e) => onChange(i, { amount: Number(e.target.value) })}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="date"
                  className="w-36"
                  value={String(d.entryDate ?? todayStr())}
                  onChange={(e) => onChange(i, { entryDate: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={String(d.note ?? "")}
                  onChange={(e) => onChange(i, { note: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Button size="icon-sm" variant="ghost" onClick={() => onRemove(i)}>
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (actionId === "create_project") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>说明</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((d, i) => (
            <TableRow key={i}>
              <TableCell>
                <Input
                  value={String(d.name ?? "")}
                  onChange={(e) => onChange(i, { name: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Select
                  value={String(d.status ?? "active")}
                  onValueChange={(v) => onChange(i, { status: v })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">进行中</SelectItem>
                    <SelectItem value="paused">暂停</SelectItem>
                    <SelectItem value="closed">已结束</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  value={String(d.description ?? "")}
                  onChange={(e) => onChange(i, { description: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Button size="icon-sm" variant="ghost" onClick={() => onRemove(i)}>
                  <Trash2 size={14} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (actionId === "create_desk") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>台子</TableHead>
            <TableHead>所属项目</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((d, i) => {
            const names = Array.isArray(d.projectNames) ? d.projectNames.map(String) : [];
            return (
              <TableRow key={i}>
                <TableCell>
                  <Input value={String(d.name ?? "")} onChange={(e) => onChange(i, { name: e.target.value })} />
                </TableCell>
                <TableCell className="min-w-[160px]">
                  <Select
                    value={Array.isArray(d.projectIds) && d.projectIds[0] ? String(d.projectIds[0]) : ""}
                    onValueChange={(v) => {
                      const p = projects.find((item) => String(item.id) === v);
                      onChange(i, { projectIds: [Number(v)], projectNames: p ? [p.name] : [] });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {names.length > 1 && (
                    <p className="mt-1 text-xs text-muted-foreground">{names.join(" / ")}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{String(d.status ?? "active")}</Badge>
                </TableCell>
                <TableCell>
                  <Button size="icon-sm" variant="ghost" onClick={() => onRemove(i)}>
                    <Trash2 size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>微信号</TableHead>
          <TableHead>可以提供的货</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((d, i) => (
          <TableRow key={i}>
            <TableCell>
              <Input value={String(d.name ?? "")} onChange={(e) => onChange(i, { name: e.target.value })} />
            </TableCell>
            <TableCell>
              <Input value={String(d.wechat ?? "")} onChange={(e) => onChange(i, { wechat: e.target.value })} />
            </TableCell>
            <TableCell>
              <Input value={String(d.goods ?? "")} onChange={(e) => onChange(i, { goods: e.target.value })} />
            </TableCell>
            <TableCell>
              <Button size="icon-sm" variant="ghost" onClick={() => onRemove(i)}>
                <Trash2 size={14} />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
