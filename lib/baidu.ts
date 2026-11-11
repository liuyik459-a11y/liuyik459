/**
 * 百度营销开放平台适配层
 * ------------------------------------------------------------
 * 本系统所有投放动作都必须经过这个适配层，不允许页面直接拼装百度接口请求。
 *
 * 现状：默认使用 MockBaiduAdapter，基于本地数据库模拟投放结果，方便演示与联调。
 * 接入真实环境时：
 *   1. 在百度营销开放平台创建应用，拿到 AppId / AppSecret，并完成广告主授权（OAuth）；
 *   2. 在 .env.local 中配置 BAIDU_APP_ID / BAIDU_APP_SECRET / BAIDU_REFRESH_TOKEN；
 *   3. 将下面的 getBaiduAdapter() 改为返回 RealBaiduAdapter 实例即可，页面与接口无需改动。
 *
 * 真实接口对应关系（均为百度营销开放平台 API）：
 *   - 账户列表：/json/sms/service/AccountService/getAccountInfo
 *   - 计划创建：/json/sms/service/FeedAdService/addCampaign
 *   - 单元创建：/json/sms/service/FeedAdService/addAdgroup
 *   - 创意创建：/json/sms/service/FeedAdService/addCreative
 *   - 计划暂停：/json/sms/service/FeedAdService/updateCampaign
 *   - 出价修改：/json/sms/service/FeedAdService/updateAdgroup
 *   - 数据报表：/json/sms/service/ReportService/getRealTimeData / getReportData
 */

import type { DatabaseSync } from "node:sqlite";
import { getDb, addLog } from "./db";

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
  createCreative(input: CreateCreativeInput): Promise<{ creativeId: string; ok: boolean }>;
  pausePlan(planId: string): Promise<{ ok: boolean }>;
  adjustBid(planId: string, ratio: number): Promise<{ ok: boolean }>;
  syncAccount(accountId: string): Promise<{ ok: boolean; syncedDays: number }>;
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

  async createCreative(input: CreateCreativeInput): Promise<{ creativeId: string; ok: boolean }> {
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

  async pausePlan(planId: string): Promise<{ ok: boolean }> {
    this.db.prepare("UPDATE plans SET status = '暂停' WHERE id = ?").run(planId);
    return { ok: true };
  }

  async adjustBid(planId: string, ratio: number): Promise<{ ok: boolean }> {
    const plan = this.db.prepare("SELECT bid FROM plans WHERE id = ?").get(planId) as
      | { bid: number }
      | undefined;
    if (!plan) return { ok: false };
    this.db
      .prepare("UPDATE plans SET bid = ? WHERE id = ?")
      .run(Number((plan.bid * ratio).toFixed(2)), planId);
    return { ok: true };
  }

  async syncAccount(accountId: string): Promise<{ ok: boolean; syncedDays: number }> {
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

/**
 * 真实适配器骨架：保留完整方法签名，接入时补充 HTTP 请求与鉴权逻辑。
 */
class RealBaiduAdapter implements BaiduAdapter {
  readonly mode = "real" as const;

  constructor(
    private appId: string,
    private appSecret: string,
    private refreshToken: string
  ) {}

  private async request(_service: string, _params: Record<string, unknown>) {
    // TODO: 1) 使用 refreshToken 换取 accessToken；
    //       2) 调用 https://api.baidu.com/json/sms/service/...；
    //       3) 统一处理错误码与限流重试。
    throw new Error(
      "真实百度营销接口尚未接入，请先配置 BAIDU_APP_ID / BAIDU_APP_SECRET / BAIDU_REFRESH_TOKEN"
    );
  }

  async createPlan(_input: CreatePlanInput): Promise<CreatePlanResult> {
    await this.request("FeedAdService/addCampaign", {});
    return { planId: "", ok: false, message: "未接入" };
  }

  async createCreative(_input: CreateCreativeInput) {
    await this.request("FeedAdService/addCreative", {});
    return { creativeId: "", ok: false };
  }

  async pausePlan(_planId: string) {
    await this.request("FeedAdService/updateCampaign", {});
    return { ok: false };
  }

  async adjustBid(_planId: string, _ratio: number) {
    await this.request("FeedAdService/updateAdgroup", {});
    return { ok: false };
  }

  async syncAccount(_accountId: string) {
    await this.request("ReportService/getReportData", {});
    return { ok: false, syncedDays: 0 };
  }
}

let adapter: BaiduAdapter | null = null;

export function getBaiduAdapter(): BaiduAdapter {
  if (adapter) return adapter;

  const appId = process.env.BAIDU_APP_ID;
  const appSecret = process.env.BAIDU_APP_SECRET;
  const refreshToken = process.env.BAIDU_REFRESH_TOKEN;

  if (appId && appSecret && refreshToken) {
    adapter = new RealBaiduAdapter(appId, appSecret, refreshToken);
  } else {
    adapter = new MockBaiduAdapter();
  }
  return adapter;
}
