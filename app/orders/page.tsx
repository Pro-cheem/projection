"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type OrderItem = { id: string; name: string; price: number; qty: number };
type Order = {
  id: string;
  status: "PENDING" | "RECEIVED";
  receivedBy: string | null;
  receivedAt: string | null;
  createdAt: string;
  name: string;
  phone: string;
  address: string;
  items: OrderItem[];
  total: number;
};

export default function OrdersPage() {
  const { data: session, status: authStatus } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/web-orders", { cache: "no-store" });
      if (res.status === 401) {
        setError("غير مصرح لك بعرض الطلبات. يلزم تسجيل الدخول بصلاحية موظف أو مدير أو أدمن.");
        setOrders([]);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data?.orders) ? data.orders : [];
      // Normalize items and totals
      const norm: Order[] = list.map((o: any) => ({
        id: o.id,
        status: o.status,
        receivedBy: o.receivedBy ?? null,
        receivedAt: o.receivedAt ?? null,
        createdAt: o.createdAt,
        name: o.name,
        phone: o.phone,
        address: o.address,
        items: Array.isArray(o.items) ? o.items : [],
        total: Number(o.total ?? 0),
      }));
      setOrders(norm);
    } catch (e: any) {
      setError(e?.message || "تعذر تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  }

  const pending = useMemo(() => orders.filter(o => o.status === "PENDING"), [orders]);
  const received = useMemo(() => orders.filter(o => o.status === "RECEIVED"), [orders]);

  async function markReceived(id: string) {
    try {
      const res = await fetch(`/api/web-orders?id=${encodeURIComponent(id)}`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(()=>null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e: any) {
      setError(e?.message || "تعذر تحديث حالة الطلب");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">الطلبات</h1>
        <a href="/" className="text-sm underline">عودة للرئيسية</a>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-3">
            <div className="h-8 w-40 bg-black/10 dark:bg-white/10 rounded" />
            <div className="h-28 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-8 w-40 bg-black/10 dark:bg-white/10 rounded" />
            <div className="h-28 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <h2 className="text-lg font-semibold mb-3">في الإنتظار</h2>
            {pending.length === 0 ? (
              <div className="text-sm text-muted-foreground">لا توجد طلبات قيد الانتظار.</div>
            ) : (
              <div className="space-y-4">
                {pending.map(o => (
                  <div key={o.id} className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-sm">{o.id}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 text-sm">
                      <div><span className="text-muted-foreground">الاسم: </span>{o.name}</div>
                      <div><span className="text-muted-foreground">الهاتف: </span>{o.phone}</div>
                      <div className="truncate"><span className="text-muted-foreground">العنوان: </span>{o.address}</div>
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      {o.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="truncate">{it.name} × {it.qty}</div>
                          <div className="tabular-nums">{Number(it.price * it.qty).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
                        </div>
                      ))}
                      <div className="border-t border-black/10 dark:border-white/10 pt-1 flex items-center justify-between font-medium">
                        <span>الإجمالي</span>
                        <span>{Number(o.total).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</span>
                      </div>
                    </div>
                    <div className="mt-3 text-right">
                      <button onClick={() => markReceived(o.id)} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm">استلام الطلب</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">تم استلامها</h2>
            {received.length === 0 ? (
              <div className="text-sm text-muted-foreground">لا توجد طلبات مستلمة.</div>
            ) : (
              <div className="space-y-4">
                {received.map(o => (
                  <div key={o.id} className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-sm">{o.id}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 text-sm">
                      <div><span className="text-muted-foreground">الاسم: </span>{o.name}</div>
                      <div><span className="text-muted-foreground">الهاتف: </span>{o.phone}</div>
                      <div className="truncate"><span className="text-muted-foreground">العنوان: </span>{o.address}</div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      تم الاستلام بواسطة: {o.receivedBy || "—"} • في {o.receivedAt ? new Date(o.receivedAt).toLocaleString() : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
