"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalDebt: number | string;
};

export default function CustomersPage() {
  const { data: session } = useSession();
  // @ts-expect-error custom role on session
  const role: string | undefined = session?.user?.role;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [creatingUserId, setCreatingUserId] = useState<string | null>(null);
  const [userCreatedInfo, setUserCreatedInfo] = useState<{customerId:string; email:string; password:string} | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState<string>("");
  const [settingPwdId, setSettingPwdId] = useState<string | null>(null);
  const [pwdValue, setPwdValue] = useState<string>("");
  const [lastSetPwd, setLastSetPwd] = useState<{ customerId: string; password: string } | null>(null);
  // Top-10 chart state
  const [topFrom, setTopFrom] = useState<string>("");
  const [topTo, setTopTo] = useState<string>("");
  const [topLoading, setTopLoading] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [topData, setTopData] = useState<Array<{ name: string; sales: number; collections: number }>>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setCustomers(data.customers || []);
    } catch (e: any) {
      setError(e.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }

  // Generate a random strong-ish password (not stored server-side)
  function genPassword(len = 10) {
    const chars = 'ABCDEFGHJKLMNPqrstuvwxyz23456789!@#$%^&*';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  // Set/reset password for the customer-linked user by customerId
  async function setCustomerPassword(customerId: string, value?: string) {
    const pwd = (value || pwdValue || '').trim() || genPassword();
    if (pwd.length < 4) { setError('Password too short'); return; }
    setSettingPwdId(customerId);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, password: pwd }),
      });
      const data = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setLastSetPwd({ customerId, password: pwd });
      setPwdValue('');
    } catch (e:any) {
      setError(e?.message || 'Failed to set password');
    } finally {
      setSettingPwdId(null);
    }
  }
  }

  async function saveCustomerEmail(customerId: string) {
    if (!editingEmailValue.trim()) return;
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, email: editingEmailValue.trim() }),
      });
      const data = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      // Update local state
      setCustomers(cs => cs.map(c => c.id === customerId ? { ...c, email: data.customer?.email || editingEmailValue.trim() } : c));
      setEditingEmailId(null);
      setEditingEmailValue("");
    } catch (e:any) {
      setError(e?.message || 'Failed to update email');
    }
  }

  useEffect(() => { load(); }, []);

  async function loadTop() {
    if (!(role === 'ADMIN' || role === 'MANAGER')) return;
    setTopLoading(true);
    setTopError(null);
    try {
      const qs = new URLSearchParams();
      if (topFrom) qs.set('from', topFrom);
      if (topTo) qs.set('to', topTo);
      const res = await fetch(`/api/customers/top?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const rows = Array.isArray(data?.top) ? data.top : [];
      setTopData(rows.map((r:any)=> ({ name: String(r.name||'—'), sales: Number(r.sales||0), collections: Number(r.collections||0) })));
    } catch (e:any) {
      setTopError(e?.message || 'Failed to load top customers');
    } finally {
      setTopLoading(false);
    }
  }

  useEffect(() => { loadTop(); /* eslint-disable-line */ }, [role]);

  async function createUserForCustomer(customerId: string) {
    setCreatingUserId(customerId);
    setError(null);
    setUserCreatedInfo(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const data = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data?.user && data?.password) {
        setUserCreatedInfo({ customerId, email: String(data.user.email || ''), password: String(data.password) });
      }
    } catch (e:any) {
      setError(e?.message || 'Failed to create user');
    } finally {
      setCreatingUserId(null);
    }
  }

  async function onCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email || undefined, phone: form.phone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setForm({ name: "", email: "", phone: "" });
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to create customer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">العملاء</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          إدارة العملاء ومتابعة حساباتهم
        </p>
      </div>

      {(role === 'ADMIN' || role === 'MANAGER') && (
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-white dark:bg-zinc-900 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">أفضل 10 عملاء</h2>
            <div className="flex flex-col sm:flex-row items-center gap-2 text-sm">
              <div className="flex items-center gap-2">
                <label className="text-sm">من:</label>
                <input type="date" value={topFrom} onChange={(e)=>setTopFrom(e.target.value)} className="rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">إلى:</label>
                <input type="date" value={topTo} onChange={(e)=>setTopTo(e.target.value)} className="rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm" />
              </div>
              <button onClick={loadTop} className="rounded bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm">تطبيق</button>
            </div>
          </div>
          {topError && <div className="mb-3 text-sm text-red-600">{topError}</div>}
          {topLoading ? (
            <div className="h-48 rounded-lg border border-black/10 dark:border-white/10 animate-pulse" />
          ) : (
            <TopChart data={topData} />
          )}
        </div>
      )}

      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-white dark:bg-zinc-900 mb-6">
        <h2 className="font-medium mb-3">إضافة عميل جديد</h2>
        <div className="grid grid-cols-1 gap-3">
          <input
            placeholder="اسم العميل"
            value={form.name}
            onChange={e=>setForm(f=>({...f,name:e.target.value}))
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-base"
          />
          <input
            placeholder="البريد الإلكتروني (اختياري)"
            value={form.email}
            onChange={e=>setForm(f=>({...f,email:e.target.value}))
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-base"
          />
          <input
            placeholder="رقم الهاتف (اختياري)"
            value={form.phone}
            onChange={e=>setForm(f=>({...f,phone:e.target.value}))
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-base"
          />
          <button
            onClick={onCreate}
            disabled={submitting || !form.name.trim()}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-base font-semibold disabled:opacity-50"
          >
            {submitting?"جارٍ الحفظ…":"حفظ العميل"}
          </button>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 text-sm font-medium border-b border-black/10 dark:border-white/10">
          <div className="col-span-3">الاسم</div>
          <div className="col-span-4">بيانات الاتصال</div>
          <div className="col-span-3 text-right">إجمالي الدين</div>
          <div className="col-span-2 text-right">الإجراءات</div>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">جارٍ التحميل…</div>
        ) : customers.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">لا يوجد عملاء</div>
        ) : (
          customers.map(c => (
            <div key={c.id} className="p-4 border-b border-black/5 dark:border-white/5 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center">
              <div className="sm:col-span-3 text-sm mb-2 sm:mb-0">
                <a href={`/customers/${c.id}`} className="underline hover:no-underline font-medium">{c.name}</a>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {editingEmailId===c.id && (role === 'ADMIN' || role === 'MANAGER') ? (
                    <div className="flex flex-col gap-1 mt-2">
                      <input
                        value={editingEmailValue}
                        onChange={e=>setEditingEmailValue(e.target.value)}
                        className="rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs w-full"
                        placeholder="user@projection.com"
                      />
                      <div className="flex gap-1">
                        <button onClick={()=>saveCustomerEmail(c.id)} className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-xs">حفظ</button>
                        <button onClick={()=>{setEditingEmailId(null); setEditingEmailValue("");}} className="rounded border border-black/10 dark:border-white/10 px-2 py-1 text-xs">إلغاء</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs">المستخدم:</span>
                      <span className="font-mono text-xs">{c.email || '-'}</span>
                      {(role === 'ADMIN' || role === 'MANAGER') && (
                        <button onClick={()=>{setEditingEmailId(c.id); setEditingEmailValue(String(c.email||''));}} className="text-xs underline">تعديل</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="sm:col-span-4 text-sm mb-2 sm:mb-0">{c.phone ? `${c.phone}` : "—"}</div>
              <div className="sm:col-span-3 text-right text-sm mb-2 sm:mb-0 font-medium">{Number(c.totalDebt).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
              <div className="sm:col-span-2 text-right">
                <button onClick={()=>createUserForCustomer(c.id)} disabled={creatingUserId===c.id} className="rounded border border-black/10 dark:border-white/10 px-2 py-1 text-xs mb-2 w-full">
                  {creatingUserId===c.id? 'جارٍ الإنشاء…' : 'إنشاء مستخدم'}
                </button>
                {userCreatedInfo && userCreatedInfo.customerId===c.id && (
                  <div className="text-xs text-right bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded">
                    <div className="text-emerald-700 dark:text-emerald-300 font-medium">تم إنشاء المستخدم</div>
                    <div className="font-mono">البريد: {userCreatedInfo.email}</div>
                    <div className="font-mono">كلمة المرور: {userCreatedInfo.password}</div>
                  </div>
                )}
                {(role === 'ADMIN' || role === 'MANAGER') && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={settingPwdId===c.id ? pwdValue : (lastSetPwd && lastSetPwd.customerId===c.id ? lastSetPwd.password : pwdValue)}
                        onChange={e=>{ if (settingPwdId===c.id || !lastSetPwd || lastSetPwd.customerId!==c.id) setPwdValue(e.target.value); }}
                        placeholder="كلمة مرور جديدة"
                        className="rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs min-w-[12ch] flex-1"
                      />
                      <button onClick={()=>setCustomerPassword(c.id)} disabled={settingPwdId===c.id} className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-xs">
                        {settingPwdId===c.id ? 'حفظ…' : 'حفظ'}
                      </button>
                    </div>
                    <button onClick={()=>setCustomerPassword(c.id, genPassword())} disabled={settingPwdId===c.id} className="rounded border border-black/10 dark:border-white/10 px-2 py-1 text-xs w-full">
                      إنشاء كلمة مرور عشوائية
                    </button>
                    {lastSetPwd && lastSetPwd.customerId===c.id && (
                      <div className="text-emerald-700 dark:text-emerald-300 text-xs">آخر كلمة مرور: <span className="font-mono">{lastSetPwd.password}</span></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TopChart({ data }: { data: Array<{ name: string; sales: number; collections: number }> }) {
  const pad = 28;
  const barH = 18;
  const gap = 10;
  const seriesGap = 4; // between sales and collections bars
  const w = 720;
  const maxVal = Math.max(1, ...data.map(d=>Math.max(d.sales, d.collections)));
  const scaleX = (v:number)=> ((v / maxVal) * (w - pad*2));
  const rows = data.slice(0,10);
  const height = pad + rows.length * (barH*2 + seriesGap + gap);
  const egp = new Intl.NumberFormat('en-EG',{style:'currency',currency:'EGP'});

  return (
    <svg width={w} height={height} className="max-w-full">
      {/* axes */}
      <line x1={pad} x2={w-pad} y1={pad-8} y2={pad-8} stroke="#eee" />
      {/* ticks */}
      {Array.from({length:4},(_,i)=>Math.round((i+1)/4*maxVal)).map((tv,i)=> (
        <g key={i}>
          <line x1={pad + scaleX(tv)} x2={pad + scaleX(tv)} y1={pad-12} y2={height-8} stroke="#f0f0f0" />
          <text x={pad + scaleX(tv)} y={pad-16} fontSize="10" textAnchor="middle" fill="#666">{egp.format(tv)}</text>
        </g>
      ))}
      {rows.map((d, i) => {
        const yBase = pad + i * (barH*2 + seriesGap + gap);
        const sx = scaleX(d.sales);
        const cx = scaleX(d.collections);
        return (
          <g key={i}>
            <text x={4} y={yBase + barH} fontSize="11" fill="#444">{d.name}</text>
            {/* sales */}
            <rect x={pad} y={yBase} width={sx} height={barH} fill="#0ea5a0" />
            <text x={pad + sx + 4} y={yBase + barH - 4} fontSize="10" fill="#0ea5a0">{egp.format(d.sales)}</text>
            {/* collections */}
            <rect x={pad} y={yBase + barH + seriesGap} width={cx} height={barH} fill="#d97706" />
            <text x={pad + cx + 4} y={yBase + barH + seriesGap + barH - 4} fontSize="10" fill="#d97706">{egp.format(d.collections)}</text>
          </g>
        );
      })}
    </svg>
  );
}
