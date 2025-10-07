"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  capacity: string;
  price: string; // Prisma Decimal -> serialized as string
  images: { id: string; url: string }[];
};

export default function Home() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ username: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [totals, setTotals] = useState<{ invoiceCount: number; salesTotal: number; collectionsTotal: number; balancesTotal: number } | null>(null);

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

  useEffect(() => {
    (async () => {
      if (!session) { setTotals(null); return; }
      try {
        const res = await fetch("/api/users/me/summary", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setTotals({
          invoiceCount: json.totals?.invoiceCount || 0,
          salesTotal: Number(json.totals?.salesTotal || 0),
          collectionsTotal: Number(json.totals?.collectionsTotal || 0),
          balancesTotal: Number(json.totals?.balancesTotal || 0),
        });
      } catch {
        setTotals(null);
      }
    })();
  }, [session]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create user");
      setMessage("User created successfully. You can now request an order.");
      setForm({ username: "", phone: "", email: "" });
    } catch (err: any) {
      setMessage(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen text-foreground">
      <main className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {session && (
          <section className="lg:col-span-3">
            <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 p-6 shadow-sm mb-8">
              <h2 className="text-2xl font-semibold mb-2">Quick Actions</h2>
              <p className="text-sm text-muted-foreground mb-4">Choose where you want to go.</p>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <a href="/invoice" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 text-center shadow-sm">New Invoice</a>
                <a href="/stock" className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 text-center shadow-sm">Stock</a>
                <a href="/journal" className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-3 text-center shadow-sm">Journal</a>
                <a href="/customers" className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 text-center shadow-sm">Customers</a>
                <a href="/reports" className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 text-center shadow-sm">Reports</a>
              </div>
              {totals && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6">
                  <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                    <div className="text-sm text-muted-foreground">عدد الفواتير</div>
                    <div className="text-xl font-semibold">{totals.invoiceCount}</div>
                  </div>
                  <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                    <div className="text-sm text-muted-foreground">إجمالي المبيعات</div>
                    <div className="text-xl font-semibold">{totals.salesTotal.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
                  </div>
                  <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                    <div className="text-sm text-muted-foreground">إجمالي التحصيل</div>
                    <div className="text-xl font-semibold">{totals.collectionsTotal.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
                  </div>
                  <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                    <div className="text-sm text-muted-foreground">إجمالي المديونيات</div>
                    <div className="text-xl font-semibold">{totals.balancesTotal.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        <section className="lg:col-span-3">
          {!session && (
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 p-6 shadow-sm mb-8">
            <h2 className="text-2xl font-semibold mb-2">Welcome</h2>
            <p className="text-sm text-muted-foreground mb-4">Choose your role to continue, or log in.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <a href="/login?role=customer" className="rounded-xl border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/10 transition">
                <h3 className="font-medium">Customer</h3>
                <p className="text-sm text-muted-foreground">View products only.</p>
              </a>
              <a href="/login?role=representative" className="rounded-xl border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/10 transition">
                <h3 className="font-medium">Representative</h3>
                <p className="text-sm text-muted-foreground">Access invoice entry after login.</p>
              </a>
              <a href="/login?role=manager" className="rounded-xl border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/10 transition">
                <h3 className="font-medium">Manager</h3>
                <p className="text-sm text-muted-foreground">Full permissions and dashboard.</p>
              </a>
            </div>
          </div>
          )}
        </section>
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
                    <p className="mt-2 font-semibold">{Number(p.price).toLocaleString(undefined, { style: "currency", currency: "EGP" })}</p>
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
