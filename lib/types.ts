export interface Account {
  id: string;
  name: string;
  baiduUserId: string;
  industry: string;
  status: string;
  balance: number;
  dailyBudget: number;
  authStatus: string;
  operator: string;
  updatedAt: string;
  todayCost?: number;
  weekCost?: number;
  weekRoi?: number;
}

export interface Plan {
  id: string;
  accountId: string;
  name: string;
  status: string;
  budget: number;
  bid: number;
  targeting: string;
  createdAt: string;
}

export interface Material {
  id: string;
  title: string;
  type: "图片" | "视频" | "图文";
  size: string;
  tag: string;
  colorA: string;
  colorB: string;
  status: string;
  ctr: number;
  usedCount: number;
  createdAt: string;
}

export interface Creative {
  id: string;
  planId: string;
  materialId: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface BatchTask {
  id: string;
  name: string;
  accountIds: string;
  planCount: number;
  unitCount: number;
  creativeCount: number;
  status: string;
  progress: number;
  createdBy: string;
  createdAt: string;
}

export interface Rule {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  action: string;
  scope: string;
  status: string;
  triggeredCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface LogItem {
  id: string;
  action: string;
  target: string;
  detail: string;
  operator: string;
  createdAt: string;
}

export interface DailyPoint {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
}

export interface KpiSet {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cvr: number;
  cpc: number;
  cpa: number;
  roi: number;
}
