import { NextResponse } from "next/server";
import { getDb, addLog } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MaterialRow {
  id: string;
  title: string;
  type: string;
  size: string;
  tag: string;
  color_a: string;
  color_b: string;
  status: string;
  ctr: number;
  used_count: number;
  created_at: string;
}

const PALETTE = [
  ["#ff9a76", "#ff4d4f"],
  ["#7c9cff", "#3b5bdb"],
  ["#ffb3c7", "#e64980"],
  ["#c4a7ff", "#7048e8"],
  ["#ffd43b", "#f08c00"],
  ["#8ce99a", "#2f9e44"],
  ["#66d9e8", "#1098ad"],
  ["#d0bfff", "#6741d9"],
];

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM materials ORDER BY created_at DESC")
    .all() as unknown as MaterialRow[];

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      size: r.size,
      tag: r.tag,
      colorA: r.color_a,
      colorB: r.color_b,
      status: r.status,
      ctr: Number(r.ctr),
      usedCount: Number(r.used_count),
      createdAt: r.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    type?: string;
    size?: string;
    tag?: string;
  };
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "请填写素材名称" }, { status: 400 });
  }

  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS c FROM materials").get() as { c: number };
  const palette = PALETTE[Number(count.c) % PALETTE.length];
  const id = `mat_${Date.now().toString(36)}`;

  db.prepare(
    `INSERT INTO materials (id, title, type, size, tag, color_a, color_b, status, ctr, used_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.title.trim(),
    body.type || "图片",
    body.size || "1080×1080",
    body.tag || "其他",
    palette[0],
    palette[1],
    "审核中",
    0,
    0,
    new Date().toISOString()
  );

  addLog(db, "素材上传", `素材「${body.title.trim()}」`, `新增${body.type || "图片"}素材，提交审核`);

  return NextResponse.json({ data: { id } });
}
