# 创量投放 · 百度信息流批量投放系统（骨架）

面向电商推广的百度信息流广告批量投放管理后台，参考创量类投放工具的产品形态，
包含账户管理、批量创建投放、素材与创意、数据看板、自动化规则和操作日志。

当前为**可运行的前后端完整骨架**：真实页面 + 真实接口 + 本地 SQLite，投放数据由
Mock 适配器模拟，接入百度营销开放平台后即可切换为真实投放。

## 启动方式

```bash
npm install
npm run dev
```

打开 http://localhost:3000 即可。首次启动会自动建库并写入演示数据（`data/app.db`）。

```bash
npm run build && npm start   # 生产模式
```

## 功能模块

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 数据看板 | `/` | 消耗、成交金额、ROI、展现、点击率、转化；7/30/90 天趋势、账户排行、计划 TOP 8 |
| 批量投放 | `/batch` | 多账户批量建计划与创意，支持命名模板、预算出价、定向模板与素材选择 |
| 素材与创意 | `/materials` | 素材库、创意组合预览、新增素材 |
| 自动化规则 | `/rules` | 按消耗/转化成本/ROI/余额等条件自动执行暂停、调价、加预算等动作 |
| 账户管理 | `/accounts` | 账户余额、授权状态、今日消耗与日预算进度、手动同步 |
| 操作日志 | `/logs` | 批量创建、规则触发、数据同步等操作留痕 |

## 技术栈

- Next.js 15（App Router）+ TypeScript + Tailwind CSS 4
- 后端使用 Next.js Route Handlers，数据库使用 Node 内置 `node:sqlite`，无需额外安装数据库
- 前后端同一仓库，一条命令启动

## 接入真实百度营销接口

所有投放动作统一走适配层 `lib/baidu.ts`，页面不直接拼装百度接口请求。

1. 在百度营销开放平台创建应用，获取 AppId / AppSecret，并完成广告主 OAuth 授权；
2. 在 `.env.local` 中配置：

```bash
BAIDU_APP_ID=xxx
BAIDU_APP_SECRET=xxx
BAIDU_REFRESH_TOKEN=xxx
```

3. 适配层检测到凭证后会自动使用 `RealBaiduAdapter`，在 `RealBaiduAdapter.request`
   中补齐 accessToken 获取与接口调用即可，页面与业务接口无需改动。

## 目录结构

```
app/                 页面与 API 路由
  api/               账户、看板、批量投放、素材、规则、日志接口
components/          侧边栏、图表、卡片、弹窗等通用组件
lib/
  baidu.ts           百度营销适配层（Mock / Real）
  db.ts              SQLite 初始化与表结构
  seed.ts            演示数据
data/app.db          本地数据库（首次运行自动生成）
```
