import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET() {
  const g = await requireAuth();
  if (!g.ok) return g.res;
  return NextResponse.json({ item: g.session });
}
