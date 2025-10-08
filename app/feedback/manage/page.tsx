"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type Feedback = { id: string; name: string | null; phone: string | null; message: string; createdAt: string; status: 'NEW'|'READ'|'CLOSED' };

export default function ManageFeedbackPage() {
  const { data: session, status } = useSession();
  // @ts-expect-error custom role
  const role: string | undefined = session?.user?.role;
  const canView = useMemo(() => role === "MANAGER" || role === "ADMIN", [role]);
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function refreshList() {
    try {
      const res = await fetch("/api/feedback", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setItems(Array.isArray(data?.feedback) ? data.feedback : []);
    } catch (e:any) {
      setError(e?.message || 'تعذر تحميل الشكاوى');
    }
  }

  async function act(id: string, action: 'read'|'close'|'reopen') {
    setActingId(id);
    setError(null);
    try {
      const res = await fetch('/api/feedback', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      await refreshList();
    } catch (e:any) {
      setError(e?.message || 'تعذر تنفيذ العملية');
    } finally {
      setActingId(null);
    }
  }

  function StatusBadge({s}:{s:Feedback['status']}) {
    const map:any = { NEW: { text: 'جديدة', cls: 'bg-emerald-600' }, READ: { text: 'مقروءة', cls: 'bg-amber-600' }, CLOSED: { text: 'مغلقة', cls: 'bg-zinc-700' } };
    const v = map[s] || map.NEW;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-white text-xs ${v.cls}`}>{v.text}</span>;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!canView) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/feedback", { cache: "no-store" });
        const txt = await res.text();
        let data: any = null; try { data = txt ? JSON.parse(txt) : null; } catch {}
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (mounted) setItems(Array.isArray(data?.feedback) ? data.feedback : []);
      } catch (e: any) {
        if (mounted) setError(e?.message || "تعذر تحميل الشكاوى");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [canView]);

  if (status === "loading") {
    return <div className="max-w-5xl mx-auto px-6 py-10">Loading…</div>;
  }

  if (!canView) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 text-right">
        غير مصرح بالوصول لهذه الصفحة.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-right">الشكاوى والملاحظات</h1>
        <a href="/" className="text-sm underline">عودة للرئيسية</a>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 text-right">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 animate-pulse h-40" />
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-right">لا توجد شكاوى حتى الآن.</div>
      ) : (
        <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50">
              <tr>
                <th className="text-right p-2">التاريخ</th>
                <th className="text-right p-2">الاسم</th>
                <th className="text-right p-2">الهاتف</th>
                <th className="text-right p-2">الرسالة</th>
                <th className="text-right p-2">الحالة</th>
                <th className="text-right p-2">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-t border-black/5 dark:border-white/5 align-top">
                  <td className="p-2 whitespace-nowrap">{new Date(f.createdAt).toLocaleString()}</td>
                  <td className="p-2 whitespace-nowrap">{f.name || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{f.phone || "—"}</td>
                  <td className="p-2 whitespace-pre-wrap max-w-[40ch]">{f.message}</td>
                  <td className="p-2 whitespace-nowrap text-right"><StatusBadge s={f.status} /></td>
                  <td className="p-2 whitespace-nowrap text-right">
                    <div className="flex gap-2 justify-end">
                      {f.status === 'NEW' && (
                        <button onClick={()=>act(f.id,'read')} disabled={actingId===f.id} className="rounded bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 text-xs">تحديد كمقروءة</button>
                      )}
                      {(f.status === 'NEW' || f.status === 'READ') && (
                        <button onClick={()=>act(f.id,'close')} disabled={actingId===f.id} className="rounded bg-zinc-800 hover:bg-zinc-900 text-white px-2 py-1 text-xs">إغلاق</button>
                      )}
                      {f.status === 'CLOSED' && (
                        <button onClick={()=>act(f.id,'reopen')} disabled={actingId===f.id} className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-xs">إعادة فتح</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
