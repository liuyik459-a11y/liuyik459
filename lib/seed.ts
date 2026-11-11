import type { DatabaseSync } from "node:sqlite";

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoOffset(days: number, hours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9 + hours, 24, 0, 0);
  return d.toISOString();
}

const ACCOUNTS = [
  {
    id: "acc_1",
    name: "创量优品旗舰店",
    baiduUserId: "BD-880120931",
    industry: "美妆个护",
    status: "投放中",
    balance: 128650,
    dailyBudget: 5000,
    authStatus: "已授权",
    operator: "运营小张",
  },
  {
    id: "acc_2",
    name: "简衣家居服饰",
    baiduUserId: "BD-880120932",
    industry: "服饰鞋包",
    status: "投放中",
    balance: 86200,
    dailyBudget: 4000,
    authStatus: "已授权",
    operator: "运营小李",
  },
  {
    id: "acc_3",
    name: "鲜食优选食品",
    baiduUserId: "BD-880120933",
    industry: "食品生鲜",
    status: "投放中",
    balance: 42300,
    dailyBudget: 3000,
    authStatus: "已授权",
    operator: "运营小张",
  },
  {
    id: "acc_4",
    name: "智享数码配件",
    baiduUserId: "BD-880120934",
    industry: "3C数码",
    status: "投放中",
    balance: 210800,
    dailyBudget: 8000,
    authStatus: "已授权",
    operator: "运营小王",
  },
  {
    id: "acc_5",
    name: "轻养健康生活",
    baiduUserId: "BD-880120935",
    industry: "保健养生",
    status: "暂停",
    balance: 15600,
    dailyBudget: 2000,
    authStatus: "已授权",
    operator: "运营小李",
  },
  {
    id: "acc_6",
    name: "潮流鞋靴集合店",
    baiduUserId: "BD-880120936",
    industry: "服饰鞋包",
    status: "余额不足",
    balance: 1200,
    dailyBudget: 2500,
    authStatus: "待重新授权",
    operator: "运营小王",
  },
];

const PLAN_TEMPLATES: Record<string, string[]> = {
  acc_1: ["玻尿酸面膜-拉新-信息流", "抗老精华-复购-信息流", "彩妆套装-大促-信息流"],
  acc_2: ["秋冬加绒卫衣-拉新-信息流", "家居四件套-种草-信息流", "基础打底衫-复购-信息流"],
  acc_3: ["坚果零食礼包-拉新-信息流", "低脂代餐-兴趣人群-信息流", "生鲜水果-大促-信息流"],
  acc_4: ["氮化镓充电器-拉新-信息流", "磁吸充电宝-种草-信息流", "数据线三件套-复购-信息流"],
  acc_5: ["轻养蛋白粉-兴趣人群-信息流", "维生素C泡腾片-拉新-信息流", "护肝片-复购-信息流"],
  acc_6: ["老爹鞋-拉新-信息流", "马丁靴-大促-信息流", "帆布鞋-种草-信息流"],
};

const TARGETING = [
  "全国 · 18-35岁 · 移动端 · 全部时段",
  "一二线城市 · 25-40岁 · iOS优先 · 8:00-24:00",
  "广东/江苏/浙江 · 18-30岁 · 女性 · 全时段",
  "全国 · 20-45岁 · 兴趣人群包 · 9:00-23:00",
];

const AOV: Record<string, number> = {
  acc_1: 128,
  acc_2: 169,
  acc_3: 69,
  acc_4: 219,
  acc_5: 188,
  acc_6: 199,
};

const MATERIALS = [
  ["mat_1", "秋冬加绒卫衣·主图A", "图片", "1080×1080", "服饰", "#ff9a76", "#ff4d4f", "可用", 0.041, 36],
  ["mat_2", "加绒卫衣·模特上身视频", "视频", "15s · 720P", "服饰", "#7c9cff", "#3b5bdb", "可用", 0.052, 28],
  ["mat_3", "玻尿酸补水面膜·产品图", "图片", "1080×1080", "美妆", "#ffb3c7", "#e64980", "可用", 0.038, 41],
  ["mat_4", "面膜·使用场景视频", "视频", "20s · 1080P", "美妆", "#c4a7ff", "#7048e8", "可用", 0.061, 22],
  ["mat_5", "坚果零食大礼包·主图", "图片", "1080×1080", "食品", "#ffd43b", "#f08c00", "可用", 0.045, 33],
  ["mat_6", "氮化镓充电器·卖点图", "图片", "1080×1080", "3C", "#8ce99a", "#2f9e44", "审核中", 0.033, 9],
  ["mat_7", "充电器·快充对比视频", "视频", "18s · 1080P", "3C", "#66d9e8", "#1098ad", "可用", 0.057, 17],
  ["mat_8", "老爹鞋·街拍图", "图片", "1080×1080", "鞋靴", "#d0bfff", "#6741d9", "可用", 0.036, 12],
  ["mat_9", "轻养蛋白粉·冲泡视频", "视频", "12s · 720P", "保健", "#b2f2bb", "#37b24d", "已驳回", 0.028, 5],
  ["mat_10", "家居四件套·场景图", "图片", "1080×1080", "家居", "#ffc9c9", "#c92a2a", "可用", 0.048, 24],
];

const CREATIVE_TITLES = [
  "今年秋冬就穿它，加绒加厚不臃肿，现在下单立减50",
  "一件顶三件，洗衣机随便造，通勤约会都好看",
  "皮肤干到起皮？用它敷一次，第二天水润一整天",
  "熬夜脸救星来了，补水锁水，敏感肌也能用",
  "办公室囤货首选，独立包装，好吃不腻还顶饱",
  "用了它才知道，原来充电可以这么快",
  "百搭不挑脚型，走一天都不累，尺码齐全",
  "换上这套四件套，卧室质感直接翻倍",
];

const RULES = [
  ["rule_1", "高消耗低转化止损", "消耗", ">", 800, "暂停计划", "全部账户", "启用", 12, 1],
  ["rule_2", "转化成本超阈值降价", "转化成本", ">", 80, "出价下调 10%", "服饰鞋包账户", "启用", 6, 2],
  ["rule_3", "优秀 ROI 自动加预算", "ROI", ">", 2.6, "日预算上调 20%", "全部账户", "启用", 3, 3],
  ["rule_4", "账户余额不足预警", "账户余额", "<", 3000, "发送飞书通知", "全部账户", "启用", 2, 0],
  ["rule_5", "夜间低效时段止损", "时段消耗", ">", 200, "暂停 00:00-07:00", "全部账户", "停用", 0, null],
];

const LOGS = [
  ["批量创建", "投放任务「秋冬卫衣批量拉新」", "覆盖 3 个账户，创建 9 条计划、9 条创意", "运营小张", 0, 10],
  ["规则触发", "规则「高消耗低转化止损」", "计划「生鲜水果-大促-信息流」消耗 862 元、转化 1 个，已自动暂停", "系统", 1, 14],
  ["数据同步", "账户「智享数码配件」", "同步最近 7 天投放数据成功，消耗 41,268 元", "系统", 1, 9],
  ["素材上传", "素材「充电器·快充对比视频」", "上传视频素材，时长 18s，分辨率 1080P", "运营小王", 2, 16],
  ["计划调整", "计划「抗老精华-复购-信息流」", "日预算由 1,200 元调整为 1,500 元", "运营小张", 2, 11],
  ["账户授权", "账户「潮流鞋靴集合店」", "授权状态变为待重新授权，请及时处理", "系统", 3, 15],
  ["规则触发", "规则「转化成本超阈值降价」", "计划「马丁靴-大促-信息流」转化成本 96.4 元，出价已下调 10%", "系统", 3, 9],
  ["素材上传", "素材「玻尿酸补水面膜·产品图」", "上传图片素材，尺寸 1080×1080", "运营小李", 4, 13],
  ["批量创建", "投放任务「3C 数码配件批量测试」", "覆盖 2 个账户，创建 6 条计划、12 条创意", "运营小王", 5, 10],
  ["计划调整", "计划「坚果零食礼包-拉新-信息流」", "暂停投放：库存不足", "运营小张", 6, 17],
];

export function seedDatabase(db: DatabaseSync): void {
  const insertAccount = db.prepare(
    `INSERT INTO accounts (id, name, baidu_user_id, industry, status, balance, daily_budget, auth_status, operator, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertPlan = db.prepare(
    `INSERT INTO plans (id, account_id, name, status, budget, bid, targeting, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertStat = db.prepare(
    `INSERT INTO stats (id, date, account_id, plan_id, impressions, clicks, cost, conversions, revenue)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const a of ACCOUNTS) {
    insertAccount.run(
      a.id,
      a.name,
      a.baiduUserId,
      a.industry,
      a.status,
      a.balance,
      a.dailyBudget,
      a.authStatus,
      a.operator,
      new Date().toISOString()
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const planIds: string[] = [];
  ACCOUNTS.forEach((account, accountIndex) => {
    PLAN_TEMPLATES[account.id].forEach((planName, planIndex) => {
      const planId = `plan_${accountIndex + 1}_${planIndex + 1}`;
      planIds.push(planId);
      insertPlan.run(
        planId,
        account.id,
        planName,
        account.status === "暂停" ? "暂停" : planIndex === 1 ? "审核中" : "投放中",
        Math.round(account.dailyBudget / 3),
        0.6 + planIndex * 0.15,
        TARGETING[(accountIndex + planIndex) % TARGETING.length],
        isoOffset(20 + accountIndex * 3 + planIndex, planIndex)
      );
    });
  });

  for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
    const d = new Date(today.getTime() - dayOffset * 86400000);
    const date = dateStr(d);
    const weekday = d.getDay();
    const weekend = weekday === 0 || weekday === 6;

    ACCOUNTS.forEach((account, accountIndex) => {
      const plans = PLAN_TEMPLATES[account.id];
      plans.forEach((_, planIndex) => {
        const planId = `plan_${accountIndex + 1}_${planIndex + 1}`;
        const rand = mulberry32(hash(planId + date));

        let activeFactor = 0.62 + rand() * 0.38;
        if (weekend && ["acc_1", "acc_2", "acc_3", "acc_6"].includes(account.id)) activeFactor *= 1.18;
        if (account.id === "acc_5" && dayOffset < 30) activeFactor = 0;
        if (account.id === "acc_6" && dayOffset < 4) activeFactor = 0;
        if (account.status === "暂停" && dayOffset < 21) activeFactor = 0;

        const planBudget = account.dailyBudget / 3;
        const cost = planBudget * activeFactor;
        if (cost <= 0) {
          insertStat.run(`stat_${planId}_${date}`, date, account.id, planId, 0, 0, 0, 0, 0);
          return;
        }

        const cpc = 0.5 + rand() * 0.85;
        const ctr = 0.014 + rand() * 0.026;
        const cvr = 0.007 + rand() * 0.013;
        const aov = AOV[account.id] * (0.9 + rand() * 0.25);

        const clicks = Math.max(1, Math.round(cost / cpc));
        const impressions = Math.max(clicks, Math.round(clicks / ctr));
        const conversions = Math.max(0, Math.round(clicks * cvr));
        const revenue = Math.round(conversions * aov);

        insertStat.run(
          `stat_${planId}_${date}`,
          date,
          account.id,
          planId,
          impressions,
          clicks,
          Number(cost.toFixed(2)),
          conversions,
          revenue
        );
      });
    });
  }

  const insertMaterial = db.prepare(
    `INSERT INTO materials (id, title, type, size, tag, color_a, color_b, status, ctr, used_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const m of MATERIALS as Array<[string, string, string, string, string, string, string, string, number, number]>) {
    insertMaterial.run(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], isoOffset(6, 3));
  }

  const insertCreative = db.prepare(
    `INSERT INTO creatives (id, plan_id, material_id, title, description, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  CREATIVE_TITLES.forEach((title, index) => {
    const planId = planIds[index % planIds.length];
    const materialId = MATERIALS[index % MATERIALS.length][0];
    insertCreative.run(
      `creative_${index + 1}`,
      planId,
      materialId,
      title,
      "点击查看详情，限时优惠进行中",
      index % 5 === 4 ? "审核中" : "可用",
      isoOffset(3 + (index % 5), index % 8)
    );
  });

  const insertTask = db.prepare(
    `INSERT INTO batch_tasks (id, name, account_ids, plan_count, unit_count, creative_count, status, progress, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertTask.run(
    "task_seed_1",
    "秋冬卫衣批量拉新",
    JSON.stringify(["acc_2", "acc_6"]),
    9,
    9,
    9,
    "已完成",
    100,
    "运营小张",
    isoOffset(3, 2)
  );
  insertTask.run(
    "task_seed_2",
    "3C 数码配件批量测试",
    JSON.stringify(["acc_4"]),
    6,
    6,
    12,
    "已完成",
    100,
    "运营小王",
    isoOffset(5, 4)
  );

  const insertRule = db.prepare(
    `INSERT INTO rules (id, name, metric, operator, threshold, action, scope, status, triggered_count, last_triggered_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const r of RULES as Array<[string, string, string, string, number, string, string, string, number, number | null]>) {
    insertRule.run(
      r[0],
      r[1],
      r[2],
      r[3],
      r[4],
      r[5],
      r[6],
      r[7],
      r[8],
      r[9] === null ? null : isoOffset(r[9], 4),
      isoOffset(15, 1)
    );
  }

  const insertLog = db.prepare(
    `INSERT INTO logs (id, action, target, detail, operator, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  LOGS.forEach((l, index) => {
    insertLog.run(
      `log_seed_${index + 1}`,
      l[0] as string,
      l[1] as string,
      l[2] as string,
      l[3] as string,
      isoOffset(l[4] as number, l[5] as number)
    );
  });
}
