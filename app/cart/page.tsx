"use client";

import { useEffect, useMemo, useState } from "react";

type CartItem = {
  id: string;
  name: string;
  price: number;
  image?: string | null;
  qty: number;
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("cart");
      const cart = raw ? JSON.parse(raw) as CartItem[] : [];
      setItems(cart);
    } catch {}
  }, []);

  function persist(next: CartItem[]) {
    setItems(next);
    try { window.localStorage.setItem("cart", JSON.stringify(next)); } catch {}
  }

  function inc(id: string) {
    const next = items.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i);
    persist(next);
  }
  function dec(id: string) {
    const next = items.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty - 1) } : i);
    persist(next);
  }
  function removeItem(id: string) {
    const next = items.filter(i => i.id !== id);
    persist(next);
  }
  function clear() {
    persist([]);
  }

  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">العربة</h1>
        <a href="/" className="text-sm underline">متابعة التسوّق</a>
      </div>

      {items.length === 0 ? (
        <div className="text-muted-foreground">العربة فارغة.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-3">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-4 rounded-xl border border-black/10 dark:border-white/10 p-3 bg-white dark:bg-zinc-900">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt={it.name} className="w-20 h-20 object-cover rounded" />
                ) : (
                  <div className="w-20 h-20 rounded bg-gradient-to-br from-slate-200 to-slate-100 dark:from-zinc-800 dark:to-zinc-900" />)
                }
                <div className="flex-1">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-sm text-muted-foreground">{it.price.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => dec(it.id)} className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-800">-</button>
                  <div className="w-10 text-center">{it.qty}</div>
                  <button onClick={() => inc(it.id)} className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-800">+</button>
                </div>
                <button onClick={() => removeItem(it.id)} className="rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-3 py-1.5 text-sm">إزالة</button>
              </div>
            ))}
            <button onClick={clear} className="rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-1.5 text-sm">تفريغ العربة</button>
          </div>

          <aside className="rounded-xl border border-black/10 dark:border-white/10 p-4 h-fit bg-white dark:bg-zinc-900">
            <h2 className="text-lg font-semibold mb-2">الملخص</h2>
            <div className="flex items-center justify-between text-sm mb-1">
              <span>المجموع</span>
              <span>{total.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</span>
            </div>
            {items.length > 0 ? (
              <a href="/checkout" className="block w-full mt-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-center text-sm">
                إتمام الشراء
              </a>
            ) : (
              <button className="w-full mt-3 rounded-lg bg-gray-400 text-white px-4 py-2 text-sm cursor-not-allowed" disabled>
                إتمام الشراء
              </button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
