"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";

interface PublicSettings {
  mode: "mock" | "real";
  appId: string;
  scope: string;
  callbackUrl: string;
  userName: string;
  userId: string;
  openId: string;
  subject: number;
  materialStyle: number;
  landingUrl: string;
  imageUrl: string;
  hasSecretKey: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenExpired: boolean;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  lastAuthorizedAt: string;
  lastTestAt: string;
  lastTestResult: string;
  authorized: boolean;
}

interface FormState {
  appId: string;
  scope: string;
  callbackUrl: string;
  userName: string;
  subject: number;
  materialStyle: number;
  landingUrl: string;
  imageUrl: string;
  mode: "mock" | "real";
}

const EMPTY_FORM: FormState = {
  appId: "",
  scope: "",
  callbackUrl: "http://localhost:3000/api/baidu/oauth/callback",
  userName: "",
  subject: 1,
  materialStyle: 101,
  landingUrl: "",
  imageUrl: "",
  mode: "mock",
};

function fmtDate(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", { hour12: false });
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`}
    />
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [testRaw, setTestRaw] = useState("");
  const [authUrl, setAuthUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/baidu", { cache: "no-store" });
      const json = (await res.json()) as { data?: PublicSettings };
      if (json.data) {
        setSettings(json.data);
        setForm({
          appId: json.data.appId,
          scope: json.data.scope,
          callbackUrl: json.data.callbackUrl,
          userName: json.data.userName,
          subject: json.data.subject || 1,
          materialStyle: json.data.materialStyle || 101,
          landingUrl: json.data.landingUrl,
          imageUrl: json.data.imageUrl,
          mode: json.data.mode,
        });
        setTestRaw(json.data.lastTestResult || "");
      }
    } catch {
      setToast({ type: "err", text: "读取本地配置失败，请确认系统已启动" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (oauth === "success") {
      setToast({ type: "ok", text: "广告主授权成功，已保存 accessToken / refreshToken" });
    } else if (oauth === "error") {
      setToast({ type: "err", text: params.get("message") || "授权失败，请重试" });
    }
  }, [load]);

  const save = useCallback(
    async (silent = false, modeOverride?: "mock" | "real"): Promise<boolean> => {
      setBusy("save");
      try {
        const res = await fetch("/api/settings/baidu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save",
            ...form,
            mode: modeOverride ?? form.mode,
            ...(secretKey ? { secretKey } : {}),
          }),
        });
        const json = (await res.json()) as { error?: string; data?: PublicSettings };
        if (!res.ok) {
          setToast({ type: "err", text: json.error || "保存失败" });
          return false;
        }
        setSecretKey("");
        if (!silent) setToast({ type: "ok", text: "配置已保存到本机" });
        await load();
        return true;
      } catch {
        setToast({ type: "err", text: "保存失败：无法连接本地服务" });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [form, secretKey, load]
  );

  const authorize = async () => {
    setBusy("authorize");
    try {
      const ok = await save(true);
      if (!ok) return;
      const res = await fetch("/api/settings/baidu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "authorize" }),
      });
      const json = (await res.json()) as { error?: string; data?: { url: string } };
      if (!res.ok || !json.data?.url) {
        setToast({ type: "err", text: json.error || "生成授权链接失败" });
        return;
      }
      setAuthUrl(json.data.url);
      window.open(json.data.url, "_blank", "noopener,noreferrer");
      setToast({ type: "ok", text: "已打开百度授权页，请用广告主账号登录并确认授权" });
    } catch {
      setToast({ type: "err", text: "生成授权链接失败" });
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    setBusy("refresh");
    try {
      const res = await fetch("/api/settings/baidu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setToast({ type: "err", text: json.error || "刷新失败" });
        return;
      }
      setToast({ type: "ok", text: "accessToken 已刷新" });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    setTestRaw("");
    try {
      const ok = await save(true);
      if (!ok) return;
      const res = await fetch("/api/settings/baidu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const json = (await res.json()) as { error?: string; data?: { raw: string } };
      if (!res.ok) {
        setTestRaw(`失败：${json.error || "未知错误"}`);
        setToast({ type: "err", text: json.error || "测试连接失败" });
        return;
      }
      setTestRaw(json.data?.raw ?? "");
      setToast({ type: "ok", text: "测试成功：百度已返回账户数据" });
      await load();
    } catch {
      setToast({ type: "err", text: "测试连接失败：无法连接本地服务" });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("确定解除授权吗？本地保存的 accessToken / refreshToken 会被清除。")) return;
    setBusy("disconnect");
    try {
      await fetch("/api/settings/baidu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      setToast({ type: "ok", text: "已解除授权，系统切回本地演示模式" });
      setAuthUrl("");
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1040px]">
      <PageHeader
        title="百度接入设置"
        desc="百度营销开放平台 · 企业开发者资质 + 广告主 OAuth 2.0 授权"
      >
        <button
          onClick={() => void save()}
          disabled={busy !== null || loading}
          className="btn-primary flex items-center gap-1.5 disabled:opacity-60"
        >
          <Icon name="check" className="h-3.5 w-3.5" />
          {busy === "save" ? "保存中..." : "保存配置"}
        </button>
      </PageHeader>

      {toast && (
        <div
          className={`mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[12px] leading-5 ${
            toast.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-600"
          }`}
        >
          <Icon name={toast.type === "ok" ? "check" : "bell"} className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} className="text-current opacity-60 hover:opacity-100">
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
        <Icon name="sparkle" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div className="text-[11.5px] leading-5 text-brand-700">
          <p className="font-medium">这个系统在你的电脑本地运行，不消耗 token。</p>
          <p className="mt-0.5 text-brand-600/90">
            页面、数据库、百度接口调用都在本机完成；只有找 AI 修改代码时才会消耗对话 token。
            调用百度接口时只需电脑能正常上网。
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "运行模式",
            value: settings?.mode === "real" ? "真实投放" : "本地演示",
            ok: settings?.mode === "real",
          },
          {
            label: "广告主授权",
            value: settings?.authorized ? "已授权" : "未授权",
            ok: Boolean(settings?.authorized),
          },
          {
            label: "推广账户",
            value: settings?.userName || "未填写",
            ok: Boolean(settings?.userName),
          },
          {
            label: "accessToken",
            value: settings?.hasAccessToken
              ? settings.tokenExpired
                ? "已过期"
                : "有效"
              : "无",
            ok: Boolean(settings?.hasAccessToken) && !settings?.tokenExpired,
          },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-1.5 text-[11.5px] text-ink-500">
              <StatusDot ok={s.ok} />
              {s.label}
            </div>
            <div className="mt-2 truncate text-[15px] font-semibold text-ink-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* 第一步 */}
      <section className="card mt-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[12px] font-semibold text-white">
            1
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink-900">准备企业开发者资质</h2>
            <p className="text-[11.5px] text-ink-500">以下步骤必须由你的企业主体在百度平台完成，代码无法代办</p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5 text-[12px] leading-6 text-ink-700">
          {[
            "注册并登录百度营销开放平台（dev2.baidu.com），用营业执照等主体资料完成企业开发者认证；投放类接口通常不向个人开发者开放。",
            "在开放平台创建应用，拿到 AppId 和 SecretKey；回调地址填写本页下方的「回调地址」，并申请信息流投放、报告相关接口权限。",
            "在应用管理页复制授权链接中的 scope（权限代码）和平台授权页参数；部分权限需要代理商 / 服务商资质或白名单。",
          ].map((text, i) => (
            <div key={i} className="flex gap-2.5">
              <Icon name="check" className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <p>{text}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-ink-500">
          资质审核由百度完成。审核通过后，下面的授权流程才能真正拿到广告主令牌；未通过前可以继续使用本地演示模式。
        </p>
      </section>

      {/* 第二步 */}
      <section className="card mt-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[12px] font-semibold text-white">
            2
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink-900">填写应用参数</h2>
            <p className="text-[11.5px] text-ink-500">密钥只保存在本机 data/app.db，不会上传到任何服务器</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">AppId</span>
            <input
              className="input-base"
              value={form.appId}
              onChange={(e) => setForm({ ...form, appId: e.target.value })}
              placeholder="百度应用管理页的 AppId"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">
              SecretKey {settings?.hasSecretKey && <span className="text-emerald-600">（已保存）</span>}
            </span>
            <input
              type="password"
              className="input-base"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={settings?.hasSecretKey ? "留空表示不修改" : "百度应用的 SecretKey"}
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">scope（权限代码）</span>
            <input
              className="input-base"
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              placeholder="从百度应用管理页的授权链接中复制"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">回调地址（需在百度应用后台登记）</span>
            <input
              className="input-base"
              value={form.callbackUrl}
              onChange={(e) => setForm({ ...form, callbackUrl: e.target.value })}
            />
          </label>
        </div>
        <p className="mt-2 text-[10.5px] leading-5 text-slate-400">
          回调地址默认是 http://localhost:3000/api/baidu/oauth/callback。百度后台登记的回调地址必须与这里完全一致；
          如果百度应用后台不接受 localhost，需要换成一个可公网访问的 HTTPS 地址（域名或内网穿透），授权令牌仍然只保存在本机。
        </p>
      </section>

      {/* 第三步 */}
      <section className="card mt-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[12px] font-semibold text-white">
            3
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink-900">广告主 OAuth 授权</h2>
            <p className="text-[11.5px] text-ink-500">
              打开百度授权页，用广告主账号登录并确认，授权结果会自动回写本系统
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void authorize()}
            disabled={busy !== null}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-60"
          >
            <Icon name="external" className="h-3.5 w-3.5" />
            {busy === "authorize" ? "生成中..." : "生成授权链接并打开"}
          </button>
          <button
            onClick={() => void refresh()}
            disabled={busy !== null || !settings?.hasRefreshToken}
            className="flex items-center gap-1.5 rounded-[10px] border border-line px-3 py-2 text-[12.5px] text-ink-700 transition hover:border-brand-200 hover:text-brand-600 disabled:opacity-50"
          >
            <Icon name="refresh" className="h-3.5 w-3.5" />
            刷新授权
          </button>
          <button
            onClick={() => void disconnect()}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-[10px] border border-line px-3 py-2 text-[12.5px] text-rose-500 transition hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            解除授权
          </button>
        </div>

        {authUrl && (
          <div className="mt-3 rounded-lg border border-line bg-slate-50 px-3 py-2.5">
            <div className="text-[11px] text-ink-500">如果浏览器拦截了弹窗，手动打开下面的链接：</div>
            <a
              href={authUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-[11px] text-brand-600 underline"
            >
              {authUrl}
            </a>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">推广账户名称（API userName）</span>
            <input
              className="input-base"
              value={form.userName}
              onChange={(e) => setForm({ ...form, userName: e.target.value })}
              placeholder="授权后一般会自动填入；超管账户请填子账户名称"
            />
          </label>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-ink-500">
            <div>授权时间：{fmtDate(settings?.lastAuthorizedAt ?? "")}</div>
            <div>accessToken 到期：{fmtDate(settings?.accessTokenExpiresAt ?? "")}</div>
            <div>推广账户 ID：{settings?.userId || "—"}</div>
          </div>
        </div>
        <p className="mt-2 text-[10.5px] leading-5 text-slate-400">
          授权链接中的 state 每次都会重新生成，用于防止伪造回调。若提示 state 校验失败，请重新点击「生成授权链接并打开」。
        </p>
      </section>

      {/* 第四步 */}
      <section className="card mt-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[12px] font-semibold text-white">
            4
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink-900">测试连接</h2>
            <p className="text-[11.5px] text-ink-500">
              调用 AccountService/getAccountInfo，原样展示百度返回内容
            </p>
          </div>
        </div>

        <button
          onClick={() => void test()}
          disabled={busy !== null}
          className="mt-4 flex items-center gap-1.5 rounded-[10px] border border-line px-3.5 py-2 text-[12.5px] text-ink-700 transition hover:border-brand-200 hover:text-brand-600 disabled:opacity-50"
        >
          <Icon name="play" className="h-3.5 w-3.5" />
          {busy === "test" ? "测试中..." : "测试连接百度接口"}
        </button>

        {testRaw && (
          <pre className="mt-3 max-h-[340px] overflow-auto rounded-xl bg-[#0b1220] p-4 text-[11px] leading-5 text-slate-300">
            {testRaw}
          </pre>
        )}
        {settings?.lastTestAt && (
          <p className="mt-2 text-[10.5px] text-slate-400">
            最近测试：{fmtDate(settings.lastTestAt)}
          </p>
        )}
      </section>

      {/* 第五步 */}
      <section className="card mt-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[12px] font-semibold text-white">
            5
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink-900">真实投放默认参数</h2>
            <p className="text-[11.5px] text-ink-500">
              批量创建计划 / 创意时会使用这些参数，可按你的行业调整
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">营销目标 subject</span>
            <select
              className="input-base"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: Number(e.target.value) })}
            >
              <option value={1}>1 · 网站链接</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">创意样式 materialstyle</span>
            <input
              type="number"
              className="input-base"
              value={form.materialStyle}
              onChange={(e) => setForm({ ...form, materialStyle: Number(e.target.value) })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">落地页 URL</span>
            <input
              className="input-base"
              value={form.landingUrl}
              onChange={(e) => setForm({ ...form, landingUrl: e.target.value })}
              placeholder="https://你的店铺或商品页"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] text-ink-500">创意图片 URL</span>
            <input
              className="input-base"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://公网可访问的图片地址"
            />
          </label>
        </div>
        <p className="mt-2 text-[10.5px] leading-5 text-slate-400">
          默认按 101 单图链接样式拼装创意物料（title / url / pictures.image）。不同样式要求的物料字段不同，
          若百度返回物料校验错误，请按错误提示调整样式 ID 或联系我们做字段映射。
        </p>

        <div className="mt-4 rounded-xl border border-line p-3">
          <div className="text-[11.5px] font-medium text-ink-700">运行模式</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[
              {
                value: "mock" as const,
                title: "本地演示模式",
                desc: "不调用百度接口，数据写入本地，适合先熟悉系统",
              },
              {
                value: "real" as const,
                title: "真实投放模式",
                desc: "所有创建、暂停、调价都会直接调用百度接口",
              },
            ].map((m) => (
              <button
                key={m.value}
                onClick={() => setForm({ ...form, mode: m.value })}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  form.mode === m.value
                    ? "border-brand-300 bg-brand-50/60"
                    : "border-line hover:border-brand-200"
                }`}
              >
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-900">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      form.mode === m.value ? "bg-brand-600" : "bg-slate-300"
                    }`}
                  />
                  {m.title}
                </div>
                <p className="mt-1 text-[10.5px] leading-4 text-ink-500">{m.desc}</p>
              </button>
            ))}
          </div>
          {form.mode === "real" && !settings?.authorized && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              尚未完成授权，切换到真实模式会失败。请先完成第 3 步授权并填写推广账户名称。
            </p>
          )}
        </div>
      </section>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-[11px] leading-5 text-amber-700">
        <p className="font-medium">凭证安全</p>
        <p className="mt-0.5">
          AppSecret、accessToken、refreshToken 以明文保存在本机 data/app.db。请只在个人电脑使用，
          不要把 data 目录或整个项目发给别人；以后如需部署到公网，必须改成加密存储并加登录鉴权。
        </p>
      </div>
    </div>
  );
}
