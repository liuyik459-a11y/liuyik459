import { NextResponse } from "next/server";
import { getDb, addLog } from "@/lib/db";
import {
  getBaiduSettings,
  getPublicBaiduSettings,
  saveBaiduSettings,
  isRealReady,
  type BaiduSettings,
} from "@/lib/settings";
import { buildAuthorizeUrl, generateState, refreshAccessToken } from "@/lib/baidu-oauth";
import { testBaiduConnection } from "@/lib/baidu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ data: getPublicBaiduSettings() });
}

interface SavePayload {
  action?: string;
  appId?: string;
  secretKey?: string;
  scope?: string;
  callbackUrl?: string;
  userName?: string;
  subject?: number;
  materialStyle?: number;
  landingUrl?: string;
  imageUrl?: string;
  mode?: "real" | "mock";
}

export async function POST(request: Request) {
  const body = (await request.json()) as SavePayload;
  const action = body.action ?? "save";
  const db = getDb();
  const current = getBaiduSettings();

  if (action === "save") {
    const patch: Partial<BaiduSettings> = {};
    if (body.appId !== undefined) patch.appId = body.appId.trim();
    if (body.secretKey) patch.secretKey = body.secretKey.trim();
    if (body.scope !== undefined) patch.scope = body.scope.trim();
    if (body.callbackUrl !== undefined) patch.callbackUrl = body.callbackUrl.trim();
    if (body.userName !== undefined) patch.userName = body.userName.trim();
    if (body.subject !== undefined) patch.subject = Number(body.subject) || 1;
    if (body.materialStyle !== undefined) patch.materialStyle = Number(body.materialStyle) || 101;
    if (body.landingUrl !== undefined) patch.landingUrl = body.landingUrl.trim();
    if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl.trim();
    if (body.mode) {
      if (body.mode === "real") {
        const candidate = { ...current, ...patch } as typeof current;
        if (!isRealReady(candidate)) {
          return NextResponse.json(
            { error: "切换到真实模式前，请先完成授权并填写推广账户名称" },
            { status: 400 }
          );
        }
      }
      patch.mode = body.mode;
    }
    const next = saveBaiduSettings(patch);
    addLog(db, "接入配置", "百度营销开放平台", "保存接入参数（密钥仅存本机）");
    return NextResponse.json({ data: getPublicBaiduSettings(), mode: next.mode });
  }

  if (action === "authorize") {
    const s = getBaiduSettings();
    if (!s.appId || !s.secretKey) {
      return NextResponse.json({ error: "请先填写并保存 AppId 和 SecretKey" }, { status: 400 });
    }
    if (!s.scope) {
      return NextResponse.json(
        { error: "请填写 scope（从百度应用管理页生成的授权链接中复制）" },
        { status: 400 }
      );
    }
    const state = generateState();
    saveBaiduSettings({ state });
    const url = buildAuthorizeUrl(s, state);
    addLog(db, "生成授权链接", "百度营销开放平台", "等待广告主在百度页面点击授权");
    return NextResponse.json({ data: { url, state } });
  }

  if (action === "refresh") {
    const s = getBaiduSettings();
    if (!s.refreshToken || !s.userId) {
      return NextResponse.json({ error: "没有可用的 refreshToken，请重新授权" }, { status: 400 });
    }
    try {
      const token = await refreshAccessToken(s);
      saveBaiduSettings({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken || s.refreshToken,
        openId: token.openId || s.openId,
        accessTokenExpiresAt: token.expiresIn
          ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
          : s.accessTokenExpiresAt,
        refreshTokenExpiresAt: token.refreshExpiresIn
          ? new Date(Date.now() + token.refreshExpiresIn * 1000).toISOString()
          : s.refreshTokenExpiresAt,
        lastAuthorizedAt: new Date().toISOString(),
      });
      addLog(db, "刷新授权", "百度营销开放平台", "accessToken 刷新成功");
      return NextResponse.json({ data: getPublicBaiduSettings() });
    } catch (err) {
      const message = (err as Error).message;
      addLog(db, "刷新授权失败", "百度营销开放平台", message);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (action === "test") {
    try {
      const raw = await testBaiduConnection(getBaiduSettings());
      const text = JSON.stringify(raw, null, 2);
      saveBaiduSettings({
        lastTestAt: new Date().toISOString(),
        lastTestResult: text.slice(0, 4000),
      });
      addLog(db, "测试连接", "百度营销开放平台", "AccountService/getAccountInfo 调用成功");
      return NextResponse.json({ data: { raw: text } });
    } catch (err) {
      const message = (err as Error).message;
      saveBaiduSettings({
        lastTestAt: new Date().toISOString(),
        lastTestResult: `失败：${message}`,
      });
      addLog(db, "测试连接失败", "百度营销开放平台", message);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (action === "disconnect") {
    saveBaiduSettings({
      mode: "mock",
      accessToken: "",
      refreshToken: "",
      openId: "",
      userId: "",
      accessTokenExpiresAt: "",
      refreshTokenExpiresAt: "",
      state: "",
      lastAuthorizedAt: "",
    });
    addLog(db, "解除授权", "百度营销开放平台", "本地清除授权令牌，已切回演示模式");
    return NextResponse.json({ data: getPublicBaiduSettings() });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
