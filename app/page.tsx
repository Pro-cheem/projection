"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useToast } from "@/components/toast-provider";

type Product = {
  id: string;
  name: string;
  capacity: string;
  price: string; // Prisma Decimal -> serialized as string
  images: { id: string; url: string }[];
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  function addToCart(p: Product) {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("cart") : null;
      const cart: Array<{ id: string; name: string; price: number; image?: string | null; qty: number }> = raw ? JSON.parse(raw) : [];
      const idx = cart.findIndex((i) => i.id === p.id);
      const priceNum = Number(p.price);
      if (idx >= 0) {
        cart[idx].qty += 1;
      } else {
        cart.push({ id: p.id, name: p.name, price: priceNum, image: p.images?.[0]?.url || null, qty: 1 });
      }
      window.localStorage.setItem("cart", JSON.stringify(cart));
      try { window.dispatchEvent(new Event("cart:updated")); } catch {}
      toast({ variant: "success", title: "تمت الإضافة للعربة", description: `${p.name} تمت إضافته.` });
    } catch (e) {
      console.error(e);
      toast({ variant: "error", title: "تعذر الإضافة", description: "حدث خطأ أثناء إضافة المنتج إلى العربة" });
    }
  }

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const name = p.name?.toLowerCase() || "";
      const cap = p.capacity?.toLowerCase() || "";
      const price = String(p.price);
      return name.includes(q) || cap.includes(q) || price.includes(q);
    });
  }, [products, query]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        if (mounted) setProducts(data.products || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Home page is focused on store products only; removed auth-specific quick actions

  return (
    <div className="min-h-screen text-foreground">
      <main className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Store-focused homepage: removed login/roles and quick actions */}
        <section id="products" className="lg:col-span-3">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-semibold">Products</h2>
              <p className="text-sm text-muted-foreground">Browse available products.</p>
            </div>
            <div className="w-full sm:w-80">
              <label htmlFor="product-search" className="sr-only">Search products</label>
              <div className="relative">
                <input
                  id="product-search"
                  type="search"
                  inputMode="search"
                  placeholder="ابحث عن منتج..."
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 px-4 py-2 pr-9 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">🔍</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {loadingProducts ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm animate-pulse">
                    <div className="w-full h-36 bg-black/5 dark:bg-white/10 rounded-t-xl" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 w-2/3 bg-black/5 dark:bg-white/10 rounded" />
                      <div className="h-3 w-1/2 bg-black/5 dark:bg-white/10 rounded" />
                      <div className="h-5 w-1/3 bg-black/5 dark:bg-white/10 rounded" />
                    </div>
                  </div>
                ))}
              </>
            ) : products.length === 0 ? (
              <div className="col-span-full text-muted-foreground">No products yet. Admin can add products from the dashboard.</div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full text-muted-foreground">لا توجد نتائج مطابقة لبحثك.</div>
            ) : (
              filteredProducts.map((p) => (
                <div key={p.id} className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow">
                  <a href={`/products/${p.id}`} className="block">
                    {p.images?.[0]?.url ? (
                      <Image
                        src={p.images[0].url}
                        alt={p.name}
                        width={1000}
                        height={144}
                        className="w-full h-36 object-cover rounded-t-xl"
                      />
                    ) : (
                      <div className="w-full h-36 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-zinc-800 dark:to-zinc-900 rounded-t-xl" />
                    )}
                    <div className="p-4">
                      <h3 className="font-medium leading-tight">{p.name}</h3>
                      <p className="text-sm text-muted-foreground">Capacity: {p.capacity}</p>
                    </div>
                  </a>
                  <div className="px-4 pb-4 -mt-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{Number(p.price).toLocaleString(undefined, { style: "currency", currency: "EGP" })}</p>
                      <button onClick={() => addToCart(p)} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm">
                        أضف للعربة
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Self-signup removed; admins can create users in /admin/users */}
      </main>

      <footer className="border-t border-black/5 dark:border-white/10 py-8 mt-10">
        <div className="max-w-6xl mx-auto px-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Projection. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
