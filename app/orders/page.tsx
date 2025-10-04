"use client";

import { useEffect, useState } from "react";

type OrderItem = {
  product: { id: string; name: string; price: string | number };
  quantity: number;
  priceAtRequest: string | number;
};

type Order = {
  id: string;
  createdAt: string;
  requester?: { id: string; name: string | null; email: string | null };
  items: OrderItem[];
  note?: string | null;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        const text = await res.text();
        let data: any = null;
        try { data = text ? JSON.parse(text) : null; } catch {}
        if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
        setOrders(Array.isArray(data?.orders) ? data.orders : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load orders");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-2">طلباتي</h1>
      <p className="text-sm text-muted-foreground mb-6">تظهر هنا الطلبات التي قمت بإنشائها.</p>

      {loading ? (
        <div className="text-sm text-muted-foreground">جاري التحميل…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : orders.length === 0 ? (
        <div className="text-sm text-muted-foreground">لا توجد طلبات بعد.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">رقم الطلب</div>
                <div className="font-mono text-sm">{o.id}</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(o.createdAt).toLocaleString()}
              </div>
              <div className="mt-3">
                <table className="w-full text-sm">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      <th className="text-right p-2">المنتج</th>
                      <th className="text-right p-2">السعر</th>
                      <th className="text-right p-2">الكمية</th>
                      <th className="text-right p-2">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-black/10 dark:border-white/10">
                        <td className="p-2 text-right">{it.product?.name}</td>
                        <td className="p-2 text-right">{Number(it.priceAtRequest).toLocaleString(undefined,{style:'currency',currency:'EGP'})}</td>
                        <td className="p-2 text-right">{it.quantity}</td>
                        <td className="p-2 text-right">{(Number(it.priceAtRequest)*Number(it.quantity)).toLocaleString(undefined,{style:'currency',currency:'EGP'})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-right font-semibold">
                الإجمالي: {o.items.reduce((s, it)=> s + Number(it.priceAtRequest)*Number(it.quantity), 0).toLocaleString(undefined,{style:'currency',currency:'EGP'})}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
