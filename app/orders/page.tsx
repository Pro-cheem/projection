"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type OrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

type Order = {
  id: string;
  status: "pending" | "received";
  receivedBy: null | { id?: string; name?: string };
  receivedAt: null | string;
  createdAt: string;
  name: string;
  phone: string;
  address: string;
  items: OrderItem[];
  total: number;
};

export default function OrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);

  function load() {
    try {
      const raw = window.localStorage.getItem("orders");
      const list: Order[] = raw ? JSON.parse(raw) : [];
      setOrders(Array.isArray(list) ? list : []);
    } catch { setOrders([]); }
  }

  useEffect(() => {
    load();
    const onU = () => load();
    window.addEventListener("orders:updated", onU);
    window.addEventListener("storage", onU);
    return () => {
      window.removeEventListener("orders:updated", onU);
      window.removeEventListener("storage", onU);
    };
  }, []);

  const pending = useMemo(() => orders.filter(o => o.status === "pending"), [orders]);
  const received = useMemo(() => orders.filter(o => o.status === "received"), [orders]);

  function persist(next: Order[]) {
    setOrders(next);
    try { window.localStorage.setItem("orders", JSON.stringify(next)); } catch {}
    try { window.dispatchEvent(new Event("orders:updated")); } catch {}
  }

  function markReceived(id: string) {
    const uid = (session?.user as any)?.id;
    const uname = (session?.user as any)?.name || (session?.user as any)?.username;
    const next = orders.map(o => o.id === id ? { ...o, status: "received" as const, receivedBy: { id: uid, name: uname }, receivedAt: new Date().toISOString() } : o);
    persist(next);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">الطلبات</h1>
        <a href="/" className="text-sm underline">عودة للرئيسية</a>
      </div>

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
                        <div className="tabular-nums">{(it.price * it.qty).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
                      </div>
                    ))}
                    <div className="border-t border-black/10 dark:border-white/10 pt-1 flex items-center justify-between font-medium">
                      <span>الإجمالي</span>
                      <span>{o.total.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</span>
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
                    تم الاستلام بواسطة: {o.receivedBy?.name || o.receivedBy?.id || "—"} • في {o.receivedAt ? new Date(o.receivedAt).toLocaleString() : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
