import { getDb } from "./db";

export interface BaiduSettings {
  /** mock=本地演示；real=真实调用百度营销 API */
  mode: "mock" | "real";
  appId: string;
  secretKey: string;
  /** 从百度应用管理页复制的权限代码 */
  scope: string;
  /** 百度应用后台登记的回调地址 */
  callbackUrl: string;
  /** 推广账户名称，对应 API header.userName */
  userName: string;
  /** 授权推广账户 ID（回调返回） */
  userId: string;
  openId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  /** 营销目标：1=网站链接 */
  subject: number;
  /** 信息流创意样式 ID：101=单图链接 */
  materialStyle: number;
  landingUrl: string;
  imageUrl: string;
  /** OAuth state，用于回调校验 */
  state: string;
  lastAuthorizedAt: string;
  lastTestAt: string;
  lastTestResult: string;
}

const KEY = "baidu";

const DEFAULTS: BaiduSettings = {
  mode: "mock",
  appId: "",
  secretKey: "",
  scope: "",
  callbackUrl: "http://localhost:3000/api/baidu/oauth/callback",
  userName: "",
  userId: "",
  openId: "",
  accessToken: "",
  refreshToken: "",
  accessTokenExpiresAt: "",
  refreshTokenExpiresAt: "",
  subject: 1,
  materialStyle: 101,
  landingUrl: "",
  imageUrl: "",
  state: "",
  lastAuthorizedAt: "",
  lastTestAt: "",
  lastTestResult: "",
};

export function getBaiduSettings(): BaiduSettings {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(KEY) as
    | { value: string }
    | undefined;
  if (!row) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...(JSON.parse(row.value) as Partial<BaiduSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveBaiduSettings(patch: Partial<BaiduSettings>): BaiduSettings {
  const db = getDb();
  const next = { ...getBaiduSettings(), ...patch };
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(KEY, JSON.stringify(next), new Date().toISOString());
  return next;
}

/** 给前端用的脱敏配置，密钥不返回明文 */
export function getPublicBaiduSettings() {
  const s = getBaiduSettings();
  const hasToken = Boolean(s.accessToken);
  const expiresAt = s.accessTokenExpiresAt ? new Date(s.accessTokenExpiresAt).getTime() : 0;
  return {
    mode: s.mode,
    appId: s.appId,
    scope: s.scope,
    callbackUrl: s.callbackUrl,
    userName: s.userName,
    userId: s.userId,
    openId: s.openId,
    subject: s.subject,
    materialStyle: s.materialStyle,
    landingUrl: s.landingUrl,
    imageUrl: s.imageUrl,
    hasSecretKey: Boolean(s.secretKey),
    hasAccessToken: hasToken,
    hasRefreshToken: Boolean(s.refreshToken),
    tokenExpired: hasToken ? expiresAt > 0 && expiresAt <= Date.now() : false,
    accessTokenExpiresAt: s.accessTokenExpiresAt,
    refreshTokenExpiresAt: s.refreshTokenExpiresAt,
    lastAuthorizedAt: s.lastAuthorizedAt,
    lastTestAt: s.lastTestAt,
    lastTestResult: s.lastTestResult,
    authorized: Boolean(s.appId && s.secretKey && s.accessToken && s.userName),
  };
}

export function isRealReady(s: BaiduSettings): boolean {
  return Boolean(s.appId && s.secretKey && s.accessToken && s.userName);
}
