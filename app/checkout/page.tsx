"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CartItem = {
  id: string;
  name: string;
  price: number;
  image?: string | null;
  qty: number;
};

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("cart");
      const cart = raw ? (JSON.parse(raw) as CartItem[]) : [];
      setItems(cart);
      // Prefill from last order if exists
      const last = window.localStorage.getItem("lastOrderInfo");
      if (last) {
        const info = JSON.parse(last);
        if (info?.name) setName(info.name);
        if (info?.phone) setPhone(info.phone);
        if (info?.address) setAddress(info.address);
      }
    } catch {}
  }, []);

  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);

  async function submitOrder() {
    setError(null);
    if (!items.length) {
      setError("العربة فارغة. من فضلك أضف منتجات أولًا.");
      return;
    }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("برجاء إدخال الاسم ورقم الهاتف والعنوان بالكامل.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        total,
        createdAt: new Date().toISOString(),
      };
      // Try send to backend
      let createdId: string | null = null;
      let createdAtIso: string | null = null;
      try {
        const res = await fetch("/api/web-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payload.name,
            phone: payload.phone,
            address: payload.address,
            items: payload.items,
            total: payload.total,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.order?.id) {
          createdId = data.order.id;
          createdAtIso = data.order.createdAt;
        }
      } catch {}

      // Persist locally (always) for UX continuity
      window.localStorage.setItem("lastOrder", JSON.stringify(payload));
      window.localStorage.setItem("lastOrderInfo", JSON.stringify({ name: payload.name, phone: payload.phone, address: payload.address }));

      // Mirror to local orders for header badge and offline viewing
      const rawOrders = window.localStorage.getItem("orders");
      const orders: any[] = rawOrders ? JSON.parse(rawOrders) : [];
      const newOrder = {
        id: createdId || `ORD-${Date.now()}`,
        status: "pending" as const,
        receivedBy: null as null | { id?: string; name?: string },
        receivedAt: null as null | string,
        ...payload,
        createdAt: createdAtIso || payload.createdAt,
      };
      orders.unshift(newOrder);
      window.localStorage.setItem("orders", JSON.stringify(orders));
      try { window.dispatchEvent(new Event("orders:updated")); } catch {}

      // Clear cart and notify header
      window.localStorage.setItem("cart", JSON.stringify([]));
      try { window.dispatchEvent(new Event("cart:updated")); } catch {}

      setDone(true);
    } catch (e: any) {
      setError(e?.message || "تعذر إتمام الطلب");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-6 bg-white dark:bg-zinc-900">
          <h1 className="text-2xl font-bold mb-2">تم استلام الطلب</h1>
          <p className="text-sm text-muted-foreground mb-4">سنتواصل معك لتأكيد التفاصيل خلال وقت قصير.</p>
          <div className="flex gap-2">
            <a href="/" className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm">العودة للرئيسية</a>
            <a href="/cart" className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm">عرض العربة</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-semibold mb-4">إتمام الشراء</h1>
          <div className="space-y-4 rounded-xl border border-black/10 dark:border-white/10 p-4 bg-white dark:bg-zinc-900">
            <div>
              <label className="block text-sm mb-1">الاسم الكامل</label>
              <input value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" placeholder="أدخل الاسم" />
            </div>
            <div>
              <label className="block text-sm mb-1">رقم الهاتف</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" placeholder="أدخل رقم الهاتف" />
            </div>
            <div>
              <label className="block text-sm mb-1">العنوان التفصيلي</label>
              <textarea value={address} onChange={e=>setAddress(e.target.value)} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 min-h-[96px]" placeholder="المحافظة / المدينة / الحي / الشارع / علامة مميزة" />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="pt-2">
              <button onClick={submitOrder} disabled={saving} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm disabled:opacity-60">
                {saving ? "جارٍ الإرسال..." : "تأكيد الطلب"}
              </button>
            </div>
          </div>
        </div>
        <aside className="rounded-xl border border-black/10 dark:border-white/10 p-4 h-fit bg-white dark:bg-zinc-900">
          <h2 className="text-lg font-semibold mb-2">ملخص الطلب</h2>
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">لا توجد عناصر في العربة.</div>
          ) : (
            <div className="space-y-2">
              {items.map(it => (
                <div key={it.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1 truncate">{it.name} × {it.qty}</div>
                  <div className="tabular-nums">{(it.price * it.qty).toLocaleString(undefined, { style: "currency", currency: "EGP" })}</div>
                </div>
              ))}
              <div className="border-t border-black/10 dark:border-white/10 mt-2 pt-2 flex items-center justify-between font-medium">
                <span>الإجمالي</span>
                <span>{total.toLocaleString(undefined, { style: "currency", currency: "EGP" })}</span>
              </div>
            </div>
          )}
          <a href="/cart" className="block mt-3 text-xs underline">العودة للعربة</a>
        </aside>
      </div>
    </div>
  );
}
