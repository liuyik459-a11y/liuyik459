import crypto from "node:crypto";
import type { BaiduSettings } from "./settings";

/**
 * 百度营销开放平台 OAuth2.0
 * 官方文档：dev2.baidu.com -> API介绍 -> OAuth2.0授权介绍
 * 授权页模板：https://u.baidu.com/oauth/page/index?platformId=...&appId=...&scope=...&state=...&callback=...
 * 换取令牌：POST https://u.baidu.com/oauth/accessToken
 * 刷新令牌：POST https://u.baidu.com/oauth/refreshToken
 */
export const BAIDU_OAUTH_PLATFORM_ID = "4960345965958561794";
export const BAIDU_ACCESS_TOKEN_URL = "https://u.baidu.com/oauth/accessToken";
export const BAIDU_REFRESH_TOKEN_URL = "https://u.baidu.com/oauth/refreshToken";
export const BAIDU_USER_INFO_URL = "https://u.baidu.com/oauth/getUserInfo";

interface OAuthResponse<T> {
  code?: number;
  message?: string;
  data?: T;
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  openId?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
  expiresTime?: string;
  refreshExpiresTime?: string;
  userId?: number;
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(s: BaiduSettings, state: string): string {
  const params = new URLSearchParams({
    platformId: BAIDU_OAUTH_PLATFORM_ID,
    appId: s.appId,
    scope: s.scope,
    state,
    callback: s.callbackUrl,
  });
  return `https://u.baidu.com/oauth/page/index?${params.toString()}`;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<OAuthResponse<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new Error(`请求百度 OAuth 失败：${(err as Error).message}`);
  }
  const text = await res.text();
  let json: OAuthResponse<T>;
  try {
    json = JSON.parse(text) as OAuthResponse<T>;
  } catch {
    throw new Error(`百度 OAuth 返回非 JSON（HTTP ${res.status}）：${text.slice(0, 300)}`);
  }
  if (json.code !== 0) {
    throw new Error(`百度 OAuth 返回错误（code=${json.code ?? "?"}）：${json.message ?? "未知错误"}`);
  }
  if (!json.data) {
    throw new Error(`百度 OAuth 返回缺少 data：${text.slice(0, 300)}`);
  }
  return json;
}

export async function exchangeAuthCode(
  s: BaiduSettings,
  authCode: string,
  userId: string
): Promise<TokenData> {
  const json = await postJson<TokenData>(BAIDU_ACCESS_TOKEN_URL, {
    appId: s.appId,
    authCode,
    secretKey: s.secretKey,
    grantType: "auth_code",
    userId: Number(userId),
  });
  return json.data as TokenData;
}

export async function refreshAccessToken(s: BaiduSettings): Promise<TokenData> {
  const json = await postJson<TokenData>(BAIDU_REFRESH_TOKEN_URL, {
    appId: s.appId,
    secretKey: s.secretKey,
    userId: Number(s.userId),
    refreshToken: s.refreshToken,
  });
  return json.data as TokenData;
}

export async function getAuthorizedUser(s: BaiduSettings): Promise<Record<string, unknown>> {
  const json = await postJson<Record<string, unknown>>(BAIDU_USER_INFO_URL, {
    openId: s.openId,
    accessToken: s.accessToken,
    userId: Number(s.userId),
    needSubList: true,
    pageSize: 100,
    lastPageMaxUcId: 1,
  });
  return json.data ?? {};
}

/**
 * 回调签名校验：除 signature 外的参数按 key 排序拼 JSON -> base64 -> AES/ECB/NoPadding（sk 前 16 位）。
 * 校验失败不阻断授权（本地部署可先放行），但会写进操作日志。
 */
export function verifyCallbackSignature(
  params: Record<string, string>,
  secretKey: string
): boolean | null {
  const signature = params.signature;
  if (!signature) return null;
  if (!secretKey) return false;

  const keys = ["appId", "authCode", "userId", "state", "timestamp"];
  const sorted: Record<string, string> = {};
  keys
    .filter((k) => params[k] !== undefined)
    .sort()
    .forEach((k) => {
      sorted[k] = params[k];
    });

  // 百度官方 demo：JSON -> Base64 -> AES/CBC/NoPadding，key=sk 前 16 位，IV=16 个 0
  const raw = Buffer.from(JSON.stringify(sorted), "utf8").toString("base64");
  const key = Buffer.from(secretKey.slice(0, 16), "utf8");
  const iv = Buffer.alloc(16, 0);
  const padded = Buffer.alloc(Math.ceil(raw.length / 16) * 16);
  padded.write(raw, "utf8");

  try {
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
    return encrypted.toString("base64") === signature;
  } catch {
    return false;
  }
}
