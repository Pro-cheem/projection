"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Invoice = {
  id: string;
  serial: string;
  date: string;
  total: string | number;
  collection: string | number;
  balance: string | number;
  user: { id: string; name: string | null } | null;
};

type Customer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  totalDebt: string | number;
};

type SummaryResponse = {
  ok: boolean;
  customer: Customer;
  invoices: Invoice[];
  totals: {
    invoiceCount: number;
    salesTotal: string | number;
    collectionsTotal: string | number;
    balancesTotal: string | number;
  };
  series?: Array<{ date: string; collection: number; balance: number }>;
};

export default function CustomerDetailPage() {
  const params = useParams() as any;
  const id: string = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryResponse | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const res = await fetch(`/api/customers/${id}/summary?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Server error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (id) load(); /* eslint-disable-line */ }, [id]);

  const kpis = useMemo(() => {
    const t = data?.totals;
    return [
      { label: "عدد الفواتير", value: t?.invoiceCount ?? 0 },
      { label: "إجمالي المبيعات", value: Number(t?.salesTotal || 0).toLocaleString(undefined,{style:"currency",currency:"EGP"}) },
      { label: "إجمالي التحصيل", value: Number(t?.collectionsTotal || 0).toLocaleString(undefined,{style:"currency",currency:"EGP"}) },
      { label: "إجمالي المديونيات", value: Number(t?.balancesTotal || 0).toLocaleString(undefined,{style:"currency",currency:"EGP"}) },
    ];
  }, [data]);

  const chart = useMemo(() => {
    const s = data?.series || [];
    if (!s.length) return null;
    const width = 720, height = 200, pad = 28;
    const xs = s.map((d) => new Date(d.date).getTime());
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const colVals = s.map(d=>d.collection), balVals = s.map(d=>d.balance);
    const minY = 0;
    const maxY = Math.max(1, Math.max(...colVals, ...balVals));
    const scaleX = (t:number)=> pad + ((t - minX) / Math.max(1,(maxX-minX))) * (width - pad*2);
    const scaleY = (v:number)=> height - pad - ((v - minY) / Math.max(1,(maxY-minY))) * (height - pad*2);
    const toPath = (vals: Array<{x:number,y:number}>) => vals.map((p,i)=> `${i? 'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const ptsCol = s.map(d=> ({ x: scaleX(new Date(d.date).getTime()), y: scaleY(d.collection) }));
    const ptsBal = s.map(d=> ({ x: scaleX(new Date(d.date).getTime()), y: scaleY(d.balance) }));
    const pathCol = toPath(ptsCol);
    const pathBal = toPath(ptsBal);
    const yTicks = 4;
    const tickVals = Array.from({length:yTicks+1}, (_,i)=> Math.round((i/yTicks)*maxY));
    return { width, height, pad, pathCol, pathBal, tickVals, scaleY, maxY };
  }, [data]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">ملف العميل</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-1" />
          <span>إلى</span>
          <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-1" />
          <button onClick={load} className="rounded bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm">تطبيق</button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({length:4}).map((_,i)=> (
            <div key={i} className="h-24 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-red-600 dark:text-red-400">{error}</div>
      ) : !data ? (
        <div className="text-muted-foreground">لا توجد بيانات.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
                <div className="text-sm text-muted-foreground mb-1">{k.label}</div>
                <div className="text-xl font-semibold">{k.value as any}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 mb-8">
            <div className="font-medium">{data.customer.name}</div>
            <div className="text-sm text-muted-foreground">مديونية حالية: {Number(data.customer.totalDebt).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
            <div className="text-sm mt-1">{data.customer.phone || "—"} • {data.customer.email || "—"}</div>
          </div>

          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">الرسم البياني: التحصيل والمديونية</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-1 bg-emerald-600"/> التحصيل</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-1 bg-amber-600"/> المديونية</span>
              </div>
            </div>
            {chart ? (
              <svg width={chart.width} height={chart.height} className="max-w-full">
                {/* grid */}
                {chart.tickVals.map((tv,i)=> (
                  <g key={i}>
                    <line x1={0} x2={chart.width} y1={chart.scaleY(tv)} y2={chart.scaleY(tv)} stroke="#eee" />
                    <text x={4} y={chart.scaleY(tv)-2} fontSize="10" fill="#666">{tv.toLocaleString()}</text>
                  </g>
                ))}
                {/* lines */}
                <path d={chart.pathCol} fill="none" stroke="#059669" strokeWidth={2} />
                <path d={chart.pathBal} fill="none" stroke="#d97706" strokeWidth={2} />
              </svg>
            ) : (
              <div className="text-sm text-muted-foreground">لا توجد بيانات كافية للرسم البياني.</div>
            )}
          </div>

          <section>
            <h2 className="text-lg font-semibold mb-3">الفواتير</h2>
            <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                  <tr>
                    <th className="text-right p-2">التاريخ</th>
                    <th className="text-right p-2">الرقم</th>
                    <th className="text-right p-2">المندوب</th>
                    <th className="text-right p-2">الإجمالي</th>
                    <th className="text-right p-2">التحصيل</th>
                    <th className="text-right p-2">المديونية</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.length === 0 ? (
                    <tr><td colSpan={6} className="p-3 text-muted-foreground">لا توجد فواتير.</td></tr>
                  ) : (
                    data.invoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-black/5 dark:border-white/5">
                        <td className="p-2">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="p-2">{inv.serial}</td>
                        <td className="p-2">{inv.user?.name || "—"}</td>
                        <td className="p-2">{Number(inv.total).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</td>
                        <td className="p-2">{Number(inv.collection).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</td>
                        <td className="p-2">{Number(inv.balance).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
