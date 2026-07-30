"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useSession } from "./RoleProvider";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { ALL_ROLES, ROLE_LABEL, type Role } from "@/lib/rbac";

export default function DevRoleSwitcher() {
  const session = useSession(); const router = useRouter(); const [loading, setLoading] = useState(false);
  async function switchTo(role: Role) { if (role === session.role) return; setLoading(true); try { await api.post("/api/auth/switch-role", { role }); router.push("/"); router.refresh(); } finally { setLoading(false); } }
  return <div className="flex justify-end mb-2"><DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <ChevronsUpDown size={14} />}调试角色：{ROLE_LABEL[session.role]}</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{ALL_ROLES.map((role) => <DropdownMenuItem key={role} onSelect={() => void switchTo(role)}>{role === session.role && <Check size={14} />}{ROLE_LABEL[role]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div>;
}
