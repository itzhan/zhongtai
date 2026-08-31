"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, Plus, X } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import DataState from "@/components/DataState";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, mutate } from "@/lib/api-client";
import { copyToClipboard } from "@/lib/clipboard";
import {
  goodsKeywordVariant,
  parseSupplierCategories,
  SUPPLIER_CATEGORY_LABEL,
} from "@/lib/enums";
import { fmtDate, fmtMoneyShort } from "@/lib/format";
import type { Supplier, SupplierComment, SupplierGood } from "../../desks/types";

function supplierSubtitle(item: Supplier) {
  const cats =
    parseSupplierCategories(item.category)
      .map((value) => SUPPLIER_CATEGORY_LABEL[value])
      .join(" / ") || "未分类";
  const parts = [cats];
  if (item.baseUrl) parts.push(item.baseUrl);
  if (item.contact) parts.push(`TG ${item.contact}`);
  if (item.wechat) parts.push(`微信 ${item.wechat}`);
  return parts.join(" · ");
}

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goodName, setGoodName] = useState("");
  const [goodRate, setGoodRate] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingComment, setDeletingComment] = useState<SupplierComment | null>(null);

  const reload = useCallback((quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    api
      .get<{ item: Supplier }>(`/api/suppliers/${id}`)
      .then((res) => setItem(res.item))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function addGood() {
    if (!item) return;
    const name = goodName.trim();
    if (!name) return toast.warning("请填写产品名称");
    setSaving(true);
    try {
      const ok = await mutate(
        () => api.post(`/api/suppliers/${item.id}/goods`, { name, rate: goodRate }),
        { success: "已添加", error: "添加失败" },
      );
      if (ok) {
        setGoodName("");
        setGoodRate("");
        reload(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeGood(good: SupplierGood) {
    if (!item) return;
    setSaving(true);
    try {
      const ok = await mutate(
        () => api.del(`/api/suppliers/${item.id}/goods/${good.id}`),
        { success: "已删除", error: "删除失败" },
      );
      if (ok) reload(true);
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!item) return;
    const content = commentDraft.trim();
    if (!content) return toast.warning("请填写评论");
    setSaving(true);
    try {
      const ok = await mutate(
        () => api.post(`/api/suppliers/${item.id}/comments`, { content }),
        { success: "已发表", error: "发表失败" },
      );
      if (ok) {
        setCommentDraft("");
        reload(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        back="/suppliers"
        title={item?.name ?? "供应商详情"}
        subtitle={item ? supplierSubtitle(item) : undefined}
        actions={
          <div className="flex items-center gap-2">
            {item?.baseUrl ? (
              <a href={/^https?:\/\//i.test(item.baseUrl) ? item.baseUrl : `https://${item.baseUrl}`} target="_blank" rel="noreferrer">
                <Button variant="outline">
                  <ExternalLink size={14} />
                  打开网站
                </Button>
              </a>
            ) : null}
            {item?.contact ? (
              <Button
                variant="outline"
                onClick={async () => {
                  const ok = await copyToClipboard(item.contact);
                  if (ok) toast.success("已复制 Telegram");
                  else toast.error("复制失败");
                }}
              >
                <Copy size={14} />
                复制 TG
              </Button>
            ) : null}
            {item?.wechat ? (
              <Button
                variant="outline"
                onClick={async () => {
                  const ok = await copyToClipboard(item.wechat);
                  if (ok) toast.success("已复制微信号");
                  else toast.error("复制失败");
                }}
              >
                <Copy size={14} />
                复制微信
              </Button>
            ) : null}
            <Link href="/suppliers">
              <Button variant="outline">返回列表</Button>
            </Link>
          </div>
        }
      />
      <DataState loading={loading} error={error} empty={!item} onRetry={reload}>
        {item && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">可以提供的货</CardTitle>
                  <CardDescription>
                    {parseSupplierCategories(item.category).includes("cardshop")
                      ? "卡网产品自由填写；有 GPT / Claude / Visa 等关键词会自动上色"
                      : "产品名按 GPT / Claude / AWS 关键词上色，倍率可写区间"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.goodsItems?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.goodsItems.map((good) => (
                        <Badge key={good.id} variant={goodsKeywordVariant(good.name)} className="gap-1 pr-1">
                          <span>{good.name}</span>
                          {good.rate ? <span className="tabular-nums opacity-80">{good.rate}×</span> : null}
                          <button
                            type="button"
                            className="rounded-full p-0.5 hover:bg-background/40"
                            aria-label={`删除 ${good.name}`}
                            disabled={saving}
                            onClick={() => removeGood(good)}
                          >
                            <X size={12} />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">还没有货，在下面添加</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="min-w-40 flex-1"
                      value={goodName}
                      onChange={(e) => setGoodName(e.target.value)}
                      placeholder={
                        parseSupplierCategories(item.category).includes("cardshop")
                          ? "产品，如 Visa 虚拟卡"
                          : "产品，如 Claude 官key"
                      }
                      disabled={saving}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addGood();
                        }
                      }}
                    />
                    <Input
                      className="w-32"
                      value={goodRate}
                      onChange={(e) => setGoodRate(e.target.value)}
                      placeholder="倍率 0.8-1.2"
                      disabled={saving}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addGood();
                        }
                      }}
                    />
                    <Button size="sm" className="shrink-0" onClick={addGood} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={14} />}
                      添加
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">累计消费</CardTitle>
                  <CardDescription>来自各项目记到该供应商的成本</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{fmtMoneyShort(item.spent ?? 0)}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">评论</CardTitle>
                <CardDescription>记录对这家供应商的判断，方便以后对照</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="例如：货稳、倍率浮动大、结算慢……"
                    disabled={saving}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={addComment} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={14} />}
                      发表评论
                    </Button>
                  </div>
                </div>
                {item.comments?.length ? (
                  <div className="space-y-3 border-t pt-3">
                    {item.comments.map((comment) => (
                      <div key={comment.id} className="rounded-lg border bg-muted/30 p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {comment.creatorName || comment.createdBy?.displayName || "未知"}
                            {" · "}
                            {fmtDate(comment.createdAt)}
                          </p>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="删除评论"
                            onClick={() => setDeletingComment(comment)}
                          >
                            <X size={14} />
                          </Button>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-6">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">还没有评论</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">消费明细</CardTitle>
                <CardDescription>在项目管理里记「供应商成本」后会同步到这里</CardDescription>
              </CardHeader>
              <CardContent className="p-0 border-t">
                {!item.entries?.length ? (
                  <p className="p-6 text-sm text-muted-foreground">还没有消费记录</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>项目</TableHead>
                        <TableHead className="text-right">金额</TableHead>
                        <TableHead>介绍</TableHead>
                        <TableHead>录入人</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono text-xs">{entry.entryDate}</TableCell>
                          <TableCell>
                            {entry.project ? (
                              <Link href={`/projects/${entry.project.id}`} className="hover:text-primary">
                                {entry.project.name}
                              </Link>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-warning">
                            {entry.amount == null ? "···" : fmtMoneyShort(entry.amount)}
                          </TableCell>
                          <TableCell className="max-w-[280px] truncate">{entry.note || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {entry.creatorName || entry.createdBy?.displayName || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </DataState>
      <ConfirmDialog
        open={deletingComment !== null}
        onOpenChange={(v) => !v && setDeletingComment(null)}
        title="删除这条评论？"
        description="删除后无法恢复。"
        onConfirm={async () => {
          if (!item || !deletingComment) return;
          const ok = await mutate(
            () => api.del(`/api/suppliers/${item.id}/comments/${deletingComment.id}`),
            { success: "已删除", error: "删除失败" },
          );
          setDeletingComment(null);
          if (ok) reload(true);
        }}
      />
    </>
  );
}
