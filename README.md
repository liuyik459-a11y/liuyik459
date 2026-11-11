# 创量投放 · 百度信息流批量投放系统（骨架）

面向电商推广的百度信息流广告批量投放管理后台，参考创量类投放工具的产品形态，
包含账户管理、批量创建投放、素材与创意、数据看板、自动化规则和操作日志。

当前为**可运行的前后端完整骨架**：真实页面 + 真实接口 + 本地 SQLite，投放数据由
Mock 适配器模拟，接入百度营销开放平台后即可切换为真实投放。

## 本地使用（不消耗任何 token）

本系统不调用任何大模型或云端服务，运行时**不产生 token 消耗**，只在你本机运行。
唯一需要的联网场景是后续调用百度营销接口；不接百度接口时，纯本地也能完整使用演示功能。

### Windows

1. 安装 [Node.js LTS](https://nodejs.org/zh-cn)（一路下一步即可）；
2. 把整个项目文件夹复制到电脑上（`node_modules`、`.next`、`data` 可以不复制）；
3. 双击 `启动系统-Windows.bat`，首次会自动安装依赖并构建；
4. 浏览器自动打开 `http://localhost:3000`。

### macOS

1. 安装 [Node.js LTS](https://nodejs.org/zh-cn)；
2. 双击 `启动系统-Mac.command`。若提示无法打开，右键 → 打开，或在终端执行
   `chmod +x 启动系统-Mac.command` 后再次双击。

使用期间不要关闭黑色命令行窗口，关闭即停止；浏览器只在本机访问，数据存在本机
`data/app.db`，不会上传到任何服务器。想恢复演示数据，关闭系统后删除该文件再启动即可。

## 启动方式（开发者）

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
| 接入设置 | `/settings` | 百度应用参数、广告主 OAuth 授权、测试连接、真实投放参数 |
| 操作日志 | `/logs` | 批量创建、规则触发、数据同步等操作留痕 |

## 技术栈

- Next.js 15（App Router）+ TypeScript + Tailwind CSS 4
- 后端使用 Next.js Route Handlers，数据库使用 Node 内置 `node:sqlite`，无需额外安装数据库
- 前后端同一仓库，一条命令启动

## 接入真实百度营销接口（企业资质 + 广告主 OAuth）

所有投放动作统一走适配层 `lib/baidu.ts`，页面不直接拼装百度接口请求。
真实接入在系统里的 **「接入设置」** 页面完成，不需要改 `.env`，也不需要改代码。

### 1. 企业开发者资质（百度侧办理）

1. 用营业执照等主体资料注册并登录百度营销开放平台（dev2.baidu.com），
   完成**企业开发者认证**；广告投放类接口通常不向个人开发者开放。
2. 创建应用，获得 **AppId / SecretKey**，登记回调地址：
   `http://localhost:3000/api/baidu/oauth/callback`
   （若百度后台不允许 localhost，需改成可公网访问的 HTTPS 地址，例如域名或内网穿透；
   令牌仍然只保存在本机）
3. 申请信息流投放、报告相关接口权限；部分权限需要代理商 / 服务商资质或白名单。
4. 在应用管理页复制授权链接里的 **scope（权限代码）**。

资质审核由百度完成，无法由代码代办；未通过前可以继续使用本地演示模式。

### 2. 广告主 OAuth 2.0 授权（系统内完成）

「接入设置」已实现百度官方授权流程：

- 授权页：`https://u.baidu.com/oauth/page/index?platformId=...&appId=...&scope=...&state=...&callback=...`
- 换取令牌：`POST https://u.baidu.com/oauth/accessToken`
- 刷新令牌：`POST https://u.baidu.com/oauth/refreshToken`
- 授权用户：`POST https://u.baidu.com/oauth/getUserInfo`
- 业务接口：`POST https://api.baidu.com/json/feed/v1/{Service}/{method}`
  （请求体 `{"header":{"userName":"推广账户名","accessToken":"授权码"},"body":{...}}`）
- 报告接口：`POST https://api.baidu.com/json/sms/service/OpenApiReportService/getReportData`

操作顺序：填写 AppId / SecretKey / scope → 保存 → 点「生成授权链接并打开」→
用广告主账号登录并确认 → 系统自动接收回调并保存令牌 → 点「测试连接」验证。

> 令牌只保存在本机 `data/app.db`（明文）。请勿把 `data` 目录或项目发给他人。
> 资质、授权、接口权限必须以百度后台实际审核结果为准；未经授权时系统不会对真实账户做任何操作。

### 3. 关于 token 消耗

本系统是纯本地 Web 应用，运行时**不调用任何大模型**，因此不消耗 token。
页面、数据库、百度 API 调用都在你的电脑上完成；只有请 AI 修改代码时才消耗对话 token。
接百度接口时只需电脑能正常上网。

## 目录结构

```
app/                 页面与 API 路由
  api/               账户、看板、批量投放、素材、规则、日志接口
components/          侧边栏、图表、卡片、弹窗等通用组件
lib/
  baidu.ts           百度营销适配层（Mock / Real）
  baidu-oauth.ts     百度 OAuth 授权、刷新令牌、回调验签
  settings.ts        本机接入配置（存 SQLite）
  db.ts              SQLite 初始化与表结构
  seed.ts            演示数据
data/app.db          本地数据库（首次运行自动生成）
```
