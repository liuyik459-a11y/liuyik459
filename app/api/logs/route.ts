import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  const db = getDb();
  const rows = action && action !== "all"
    ? db
        .prepare("SELECT * FROM logs WHERE action = ? ORDER BY created_at DESC LIMIT 100")
        .all(action)
    : db.prepare("SELECT * FROM logs ORDER BY created_at DESC LIMIT 100").all();

  const data = (rows as unknown as Array<{
    id: string;
    action: string;
    target: string;
    detail: string;
    operator: string;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    action: r.action,
    target: r.target,
    detail: r.detail,
    operator: r.operator,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ data });
}
