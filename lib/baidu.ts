/**
 * 百度营销开放平台适配层
 * ------------------------------------------------------------
 * 页面与业务接口只依赖 BaiduAdapter，不直接拼装百度请求。
 *
 * - 本地演示：MockBaiduAdapter，写本地 SQLite。
 * - 真实投放：RealBaiduAdapter，使用「百度营销开放平台」OAuth2.0 授权。
 *   官方接口：
 *     换取令牌  POST https://u.baidu.com/oauth/accessToken
 *     刷新令牌  POST https://u.baidu.com/oauth/refreshToken
 *     业务接口  POST https://api.baidu.com/json/feed/v1/{Service}/{method}
 *     报告接口  POST https://api.baidu.com/json/sms/service/OpenApiReportService/getReportData
 *   请求头统一为 {"header":{"userName":"推广账户名","accessToken":"授权码"},"body":{...}}
 *
 * 真实调用失败时，会把百度原始的 status / desc 原样抛给页面，绝不伪造成功。
 */

import type { DatabaseSync } from "node:sqlite";
import { getDb, addLog } from "./db";
import { getBaiduSettings, saveBaiduSettings, isRealReady } from "./settings";
import {
  exchangeAuthCode,
  refreshAccessToken,
  getAuthorizedUser,
  verifyCallbackSignature,
} from "./baidu-oauth";
import type { BaiduSettings } from "./settings";

export interface CreatePlanInput {
  accountId: string;
  name: string;
  budget: number;
  bid: number;
  targeting: string;
  operator?: string;
}

export interface CreateCreativeInput {
  planId: string;
  materialId: string;
  title: string;
  description: string;
}

export interface CreatePlanResult {
  planId: string;
  ok: boolean;
  message: string;
}

export interface BaiduAdapter {
  readonly mode: "mock" | "real";
  createPlan(input: CreatePlanInput): Promise<CreatePlanResult>;
  createCreative(
    input: CreateCreativeInput
  ): Promise<{ creativeId: string; ok: boolean; message?: string }>;
  pausePlan(planId: string): Promise<{ ok: boolean; message?: string }>;
  adjustBid(planId: string, ratio: number): Promise<{ ok: boolean; message?: string }>;
  syncAccount(accountId: string): Promise<{ ok: boolean; syncedDays: number; message?: string }>;
}

class MockBaiduAdapter implements BaiduAdapter {
  readonly mode = "mock" as const;
  private db: DatabaseSync;

  constructor() {
    this.db = getDb();
  }

  async createPlan(input: CreatePlanInput): Promise<CreatePlanResult> {
    const planId = `plan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    this.db
      .prepare(
        `INSERT INTO plans (id, account_id, name, status, budget, bid, targeting, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        planId,
        input.accountId,
        input.name,
        "投放中",
        input.budget,
        input.bid,
        input.targeting,
        new Date().toISOString()
      );
    return { planId, ok: true, message: "创建成功" };
  }

  async createCreative(input: CreateCreativeInput) {
    const creativeId = `creative_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    this.db
      .prepare(
        `INSERT INTO creatives (id, plan_id, material_id, title, description, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        creativeId,
        input.planId,
        input.materialId,
        input.title,
        input.description,
        "审核中",
        new Date().toISOString()
      );
    return { creativeId, ok: true };
  }

  async pausePlan(planId: string) {
    this.db.prepare("UPDATE plans SET status = '暂停' WHERE id = ?").run(planId);
    return { ok: true };
  }

  async adjustBid(planId: string, ratio: number) {
    const plan = this.db.prepare("SELECT bid FROM plans WHERE id = ?").get(planId) as
      | { bid: number }
      | undefined;
    if (!plan) return { ok: false };
    this.db
      .prepare("UPDATE plans SET bid = ? WHERE id = ?")
      .run(Number((plan.bid * ratio).toFixed(2)), planId);
    return { ok: true };
  }

  async syncAccount(accountId: string) {
    const account = this.db.prepare("SELECT name FROM accounts WHERE id = ?").get(accountId) as
      | { name: string }
      | undefined;
    if (!account) return { ok: false, syncedDays: 0 };
    this.db.prepare("UPDATE accounts SET updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      accountId
    );
    addLog(this.db, "数据同步", `账户「${account.name}」`, "同步最近 7 天投放数据成功（模拟）");
    return { ok: true, syncedDays: 7 };
  }
}

interface PlanRow {
  id: string;
  account_id: string;
  name: string;
  budget: number;
  bid: number;
  baidu_id: string | null;
  baidu_adgroup_id: string | null;
}

function apiError(payload: Record<string, unknown>): string | null {
  const header = payload.header as
    | { status?: number; desc?: string; failures?: Array<{ code?: number; message?: string }> }
    | undefined;
  if (header && header.status !== undefined && Number(header.status) !== 0) {
    const failures = (header.failures ?? [])
      .map((f) => `${f.code ?? ""} ${f.message ?? ""}`.trim())
      .filter(Boolean)
      .join("；");
    return `百度接口返回错误（status=${header.status}）：${header.desc ?? ""}${
      failures ? `；${failures}` : ""
    }`;
  }
  const code = payload.code;
  if (code !== undefined && Number(code) !== 0) {
    return `百度接口返回错误（code=${code}）：${String(payload.message ?? "未知错误")}`;
  }
  return null;
}

class RealBaiduAdapter implements BaiduAdapter {
  readonly mode = "real" as const;
  private db: DatabaseSync;

  constructor() {
    this.db = getDb();
  }

  private async ensureSettings(): Promise<BaiduSettings> {
    const s = getBaiduSettings();
    if (!isRealReady(s)) {
      throw new Error(
        "真实模式尚未配置完整：请在「接入设置」填写 AppId / SecretKey，并完成广告主授权、填写推广账户名称"
      );
    }
    const expiresAt = s.accessTokenExpiresAt ? new Date(s.accessTokenExpiresAt).getTime() : 0;
    if (expiresAt > 0 && expiresAt - Date.now() < 5 * 60 * 1000 && s.refreshToken) {
      const token = await refreshAccessToken(s);
      const next = saveBaiduSettings({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken || s.refreshToken,
        accessTokenExpiresAt: token.expiresIn
          ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
          : s.accessTokenExpiresAt,
        refreshTokenExpiresAt: token.refreshExpiresIn
          ? new Date(Date.now() + token.refreshExpiresIn * 1000).toISOString()
          : s.refreshTokenExpiresAt,
        openId: token.openId || s.openId,
      });
      return next;
    }
    return s;
  }

  private async post(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const s = await this.ensureSettings();
    const payload = {
      header: { userName: s.userName, accessToken: s.accessToken },
      body,
    };
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
    } catch (err) {
      throw new Error(`调用百度接口失败：${(err as Error).message}`);
    }
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`百度接口返回非 JSON（HTTP ${res.status}）：${text.slice(0, 400)}`);
    }
    const err = apiError(json);
    if (err) throw new Error(err);
    return json;
  }

  private dataOf(json: Record<string, unknown>): unknown {
    const body = json.body as Record<string, unknown> | undefined;
    if (body && "data" in body) return body.data;
    return json.data;
  }

  private async feed(method: string, body: Record<string, unknown>) {
    return this.post(`https://api.baidu.com/json/feed/v1/${method}`, body);
  }

  async createPlan(input: CreatePlanInput): Promise<CreatePlanResult> {
    const s = getBaiduSettings();
    if (!Number.isFinite(input.budget) || input.budget < 50) {
      return { planId: "", ok: false, message: "百度信息流计划预算最低为 50 元" };
    }
    try {
      const json = await this.feed("CampaignFeedService/addCampaignFeed", {
        campaignFeedTypes: [
          {
            campaignFeedName: input.name,
            subject: Number(s.subject) || 1,
            budget: input.budget,
            bidtype: 1,
            bid: input.bid,
            pause: false,
          },
        ],
      });
      const data = this.dataOf(json);
      const item = (Array.isArray(data) ? data[0] : data) as
        | { campaignFeedId?: number | string }
        | undefined;
      const campaignFeedId = item?.campaignFeedId;
      if (!campaignFeedId) {
        throw new Error(`百度未返回 campaignFeedId：${JSON.stringify(json).slice(0, 500)}`);
      }
      const planId = String(campaignFeedId);
      this.db
        .prepare(
          `INSERT INTO plans (id, account_id, name, status, budget, bid, targeting, created_at, baidu_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          planId,
          input.accountId,
          input.name,
          "投放中",
          input.budget,
          input.bid,
          input.targeting,
          new Date().toISOString(),
          planId
        );
      return { planId, ok: true, message: "创建成功（百度已返回计划ID）" };
    } catch (err) {
      const message = (err as Error).message;
      addLog(this.db, "真实投放失败", `计划「${input.name}」`, message, input.operator ?? "运营小张");
      return { planId: "", ok: false, message };
    }
  }

  private getPlan(planId: string): PlanRow | undefined {
    return this.db.prepare("SELECT * FROM plans WHERE id = ?").get(planId) as PlanRow | undefined;
  }

  private async ensureAdgroup(plan: PlanRow): Promise<string> {
    if (plan.baidu_adgroup_id) return plan.baidu_adgroup_id;
    const campaignFeedId = Number(plan.baidu_id ?? plan.id);
    if (!Number.isFinite(campaignFeedId)) {
      throw new Error("本地计划缺少百度计划ID，无法创建单元");
    }
    const json = await this.feed("AdgroupFeedService/addAdgroupFeed", {
      adgroupFeedTypes: [
        {
          campaignFeedId,
          adgroupFeedName: `${plan.name}-单元`,
          bid: Number(plan.bid),
          ftypes: [1],
          bidtype: 1,
          pause: false,
        },
      ],
    });
    const data = this.dataOf(json);
    const item = (Array.isArray(data) ? data[0] : data) as
      | { adgroupFeedId?: number | string }
      | undefined;
    const adgroupFeedId = item?.adgroupFeedId;
    if (!adgroupFeedId) {
      throw new Error(`百度未返回 adgroupFeedId：${JSON.stringify(json).slice(0, 500)}`);
    }
    this.db
      .prepare("UPDATE plans SET baidu_adgroup_id = ? WHERE id = ?")
      .run(String(adgroupFeedId), plan.id);
    return String(adgroupFeedId);
  }

  async createCreative(input: CreateCreativeInput) {
    const plan = this.getPlan(input.planId);
    if (!plan) return { creativeId: "", ok: false, message: "本地找不到该计划" };
    const s = getBaiduSettings();
    if (!s.landingUrl || !s.imageUrl) {
      return {
        creativeId: "",
        ok: false,
        message: "真实创意需要落地页和图片：请先在「接入设置」填写落地页 URL 与图片 URL",
      };
    }
    try {
      const adgroupId = await this.ensureAdgroup(plan);
      const material = JSON.stringify({
        title: input.title,
        url: s.landingUrl,
        pictures: [{ image: s.imageUrl }],
      });
      const json = await this.feed("CreativeFeedService/addCreativeFeed", {
        creativeFeedTypes: [
          {
            adgroupFeedId: Number(adgroupId),
            materialstyle: Number(s.materialStyle) || 101,
            creativeFeedName: input.title.slice(0, 50),
            material,
            ideaType: 0,
            pause: false,
          },
        ],
      });
      const data = this.dataOf(json);
      const item = (Array.isArray(data) ? data[0] : data) as
        | { creativeFeedId?: number | string }
        | undefined;
      const creativeFeedId = item?.creativeFeedId;
      if (!creativeFeedId) {
        throw new Error(`百度未返回 creativeFeedId：${JSON.stringify(json).slice(0, 500)}`);
      }
      const creativeId = String(creativeFeedId);
      this.db
        .prepare(
          `INSERT INTO creatives (id, plan_id, material_id, title, description, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          creativeId,
          input.planId,
          input.materialId,
          input.title,
          input.description,
          "审核中",
          new Date().toISOString()
        );
      return { creativeId, ok: true, message: "百度已受理创意" };
    } catch (err) {
      return { creativeId: "", ok: false, message: (err as Error).message };
    }
  }

  async pausePlan(planId: string) {
    const plan = this.getPlan(planId);
    if (!plan) return { ok: false, message: "本地找不到该计划" };
    const realId = Number(plan.baidu_id ?? plan.id);
    try {
      await this.feed("CampaignFeedService/updateCampaignFeed", {
        campaignFeedTypes: [{ campaignFeedId: realId, pause: true }],
      });
      this.db.prepare("UPDATE plans SET status = '暂停' WHERE id = ?").run(planId);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  async adjustBid(planId: string, ratio: number) {
    const plan = this.getPlan(planId);
    if (!plan) return { ok: false, message: "本地找不到该计划" };
    const nextBid = Number((Number(plan.bid) * ratio).toFixed(2));
    try {
      if (plan.baidu_adgroup_id) {
        await this.feed("AdgroupFeedService/updateAdgroupFeed", {
          adgroupFeedTypes: [{ adgroupFeedId: Number(plan.baidu_adgroup_id), bid: nextBid }],
        });
      } else {
        await this.feed("CampaignFeedService/updateCampaignFeed", {
          campaignFeedTypes: [
            { campaignFeedId: Number(plan.baidu_id ?? plan.id), bid: nextBid, bidtype: 1 },
          ],
        });
      }
      this.db.prepare("UPDATE plans SET bid = ? WHERE id = ?").run(nextBid, planId);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  async syncAccount(accountId: string) {
    const account = this.db.prepare("SELECT name FROM accounts WHERE id = ?").get(accountId) as
      | { name: string }
      | undefined;
    if (!account) return { ok: false, syncedDays: 0, message: "本地找不到该账户" };

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    try {
      const json = await this.post(
        "https://api.baidu.com/json/sms/service/OpenApiReportService/getReportData",
        {
          reportType: 2172649,
          startDate: fmt(start),
          endDate: fmt(end),
          timeUnit: "DAY",
          columns: ["date", "userName", "impression", "click", "cost", "ctr", "cpc"],
          sorts: [],
          filters: [],
          startRow: 0,
          rowCount: 500,
          needSum: false,
        }
      );
      const data = this.dataOf(json) as
        | { rows?: Array<Record<string, string>> }
        | undefined;
      const rows = data?.rows ?? [];
      this.db
        .prepare("DELETE FROM stats WHERE account_id = ? AND date >= ? AND date <= ?")
        .run(accountId, fmt(start), fmt(end));
      const insert = this.db.prepare(
        `INSERT INTO stats (id, date, account_id, plan_id, impressions, clicks, cost, conversions, revenue)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const dates = new Set<string>();
      for (const row of rows) {
        const date = String(row.date ?? "").slice(0, 10);
        if (!date) continue;
        dates.add(date);
        insert.run(
          `stat_${accountId}_${date}_${Math.random().toString(36).slice(2, 6)}`,
          date,
          accountId,
          "all",
          Number(row.impression ?? 0),
          Number(row.click ?? 0),
          Number(row.cost ?? 0),
          0,
          0
        );
      }
      this.db
        .prepare("UPDATE accounts SET updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), accountId);
      addLog(
        this.db,
        "数据同步",
        `账户「${account.name}」`,
        `从百度接口同步 ${dates.size} 天数据（信息流整体账户报告 2172649）`
      );
      return { ok: true, syncedDays: dates.size };
    } catch (err) {
      return { ok: false, syncedDays: 0, message: (err as Error).message };
    }
  }
}

let adapter: BaiduAdapter | null = null;
let adapterKey = "";

export function getBaiduAdapter(): BaiduAdapter {
  const s = getBaiduSettings();
  const key = `${s.mode}:${s.appId}:${s.accessToken}:${s.userName}`;
  if (adapter && adapterKey === key) return adapter;
  adapter = s.mode === "real" ? new RealBaiduAdapter() : new MockBaiduAdapter();
  adapterKey = key;
  return adapter;
}

/** 设置页「测试连接」：原样返回百度响应，便于排查 */
export async function testBaiduConnection(s: BaiduSettings) {
  if (!s.accessToken || !s.userName) {
    throw new Error("请先完成广告主授权，并填写推广账户名称（userName）");
  }
  const payload = {
    header: { userName: s.userName, accessToken: s.accessToken },
    body: {
      accountFields: [
        "userId",
        "balance",
        "pcBalance",
        "mobileBalance",
        "cost",
        "payment",
        "budgetType",
        "budget",
      ],
    },
  };
  const res = await fetch("https://api.baidu.com/json/sms/service/AccountService/getAccountInfo", {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`百度返回非 JSON（HTTP ${res.status}）：${text.slice(0, 400)}`);
  }
  const err = apiError(json);
  if (err) throw new Error(err);
  return json;
}

/** 授权回调：验签 -> 换 token -> 拉授权用户信息 -> 落库 */
export async function completeOAuthCallback(params: Record<string, string>) {
  const s = getBaiduSettings();
  if (!s.appId || !s.secretKey) {
    throw new Error("尚未配置 AppId / SecretKey");
  }
  if (!params.state || params.state !== s.state) {
    throw new Error("state 校验失败：授权链接已过期，请回到「接入设置」重新生成授权链接");
  }
  if (!params.authCode || !params.userId) {
    throw new Error("百度回调缺少 authCode 或 userId");
  }
  const signatureValid = verifyCallbackSignature(params, s.secretKey);
  const token = await exchangeAuthCode(s, params.authCode, params.userId);

  const next = saveBaiduSettings({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken || s.refreshToken,
    openId: token.openId || s.openId,
    userId: String(token.userId ?? params.userId),
    accessTokenExpiresAt: token.expiresIn
      ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
      : s.accessTokenExpiresAt,
    refreshTokenExpiresAt: token.refreshExpiresIn
      ? new Date(Date.now() + token.refreshExpiresIn * 1000).toISOString()
      : s.refreshTokenExpiresAt,
    lastAuthorizedAt: new Date().toISOString(),
    mode: "real",
    state: "",
  });

  let masterName = "";
  try {
    const info = await getAuthorizedUser(next);
    masterName = String(info.masterName ?? "");
    if (masterName) {
      saveBaiduSettings({ userName: next.userName || masterName });
    }
  } catch {
    // 授权已成功，用户信息拉取失败不影响后续手动填写账户名
  }

  addLog(
    getDb(),
    "广告主授权",
    `推广账户 ${next.userName || masterName || next.userId}`,
    `OAuth2.0 授权成功，签名校验：${
      signatureValid === null ? "百度未返回签名" : signatureValid ? "通过" : "未通过"
    }`
  );
  return { ...next, userName: next.userName || masterName, signatureValid };
}
