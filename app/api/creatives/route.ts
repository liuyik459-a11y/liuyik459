import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.title, c.description, c.status, c.created_at,
              m.title AS material_title, m.type AS material_type, m.color_a, m.color_b,
              p.name AS plan_name, a.name AS account_name
       FROM creatives c
       LEFT JOIN materials m ON m.id = c.material_id
       LEFT JOIN plans p ON p.id = c.plan_id
       LEFT JOIN accounts a ON a.id = p.account_id
       ORDER BY c.created_at DESC LIMIT 30`
    )
    .all() as unknown as Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    created_at: string;
    material_title: string;
    material_type: string;
    color_a: string;
    color_b: string;
    plan_name: string;
    account_name: string;
  }>;

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      createdAt: r.created_at,
      materialTitle: r.material_title,
      materialType: r.material_type,
      colorA: r.color_a,
      colorB: r.color_b,
      planName: r.plan_name,
      accountName: r.account_name,
    })),
  });
}
