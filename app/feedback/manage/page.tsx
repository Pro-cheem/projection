"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type Feedback = { id: string; name: string | null; phone: string | null; message: string; createdAt: string };

export default function ManageFeedbackPage() {
  const { data: session, status } = useSession();
  // @ts-expect-error custom role
  const role: string | undefined = session?.user?.role;
  const canView = useMemo(() => role === "MANAGER", [role]);
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-t border-black/5 dark:border-white/5 align-top">
                  <td className="p-2 whitespace-nowrap">{new Date(f.createdAt).toLocaleString()}</td>
                  <td className="p-2 whitespace-nowrap">{f.name || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{f.phone || "—"}</td>
                  <td className="p-2 whitespace-pre-wrap">{f.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
