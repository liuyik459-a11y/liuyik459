import { NextResponse } from "next/server";
import { addLog, getDb } from "@/lib/db";
import { completeOAuthCallback } from "@/lib/baidu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  try {
    await completeOAuthCallback(params);
    return NextResponse.redirect(new URL("/settings?oauth=success", url.origin));
  } catch (err) {
    const message = (err as Error).message;
    addLog(getDb(), "广告主授权失败", "百度营销开放平台", message);
    const target = new URL("/settings", url.origin);
    target.searchParams.set("oauth", "error");
    target.searchParams.set("message", message.slice(0, 300));
    return NextResponse.redirect(target);
  }
}
