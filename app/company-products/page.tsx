"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  capacity: string;
  price: string | number;
  images: { id: string; url: string }[];
  properties?: Record<string, any> | null;
  stockQty?: number;
};

export default function CompanyProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const data = await res.json();
        const list: Product[] = Array.isArray(data?.products) ? data.products : [];
        // Filter by properties.type === 'COMPANY' and in-stock
        const filtered = list.filter(p => {
          const t = (p as any)?.properties?.type;
          const inStock = Number((p as any)?.stockQty ?? 0) > 0;
          return t === 'COMPANY' && inStock;
        });
        setProducts(filtered);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">منتجات الشركة</h1>
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : products.length === 0 ? (
        <div className="text-muted-foreground">لا توجد منتجات.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.map(p => (
            <a key={p.id} href={`/products/${p.id}`} className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow block">
              {p.images?.[0]?.url ? (
                <img src={p.images[0].url} alt={p.name} className="w-full h-auto max-h-64 object-contain rounded-t-xl bg-white dark:bg-zinc-900" />
              ) : (
                <div className="w-full h-36 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-zinc-800 dark:to-zinc-900 rounded-t-xl" />
              )}
              <div className="p-4 text-right">
                <h3 className="font-medium leading-tight">{p.name}</h3>
                <p className="text-sm text-muted-foreground">السعة: {p.capacity}</p>
                <p className="font-semibold mt-1">{Number(p.price).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
