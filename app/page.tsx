"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useToast } from "@/components/toast-provider";

type Product = {
  id: string;
  name: string;
  capacity: string;
  price: string; // Prisma Decimal -> serialized as string
  images: { id: string; url: string }[];
  properties?: Record<string, any> | null;
  stockQty?: number;
};

function HeroCard({ imageUrl, title, href, adminExplore, onExplore }: { imageUrl?: string; title: string; href: string; adminExplore?: boolean; onExplore?: () => void }) {
  return (
    <a href={href} className="block group rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 relative">
      {imageUrl ? (
        <img src={imageUrl} alt={title} className="w-full h-[220px] sm:h-[280px] object-cover" />
      ) : (
        <div className="w-full h-[220px] sm:h-[280px] bg-gradient-to-br from-slate-200 to-slate-100 dark:from-zinc-800 dark:to-zinc-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
        <h3 className="text-white text-xl font-semibold drop-shadow">{title}</h3>
        {adminExplore ? (
          <button
            onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); onExplore && onExplore(); }}
            className="inline-block rounded-lg bg-white/90 text-zinc-900 px-3 py-1.5 text-sm shadow-sm group-hover:bg-white transition"
            type="button"
          >
            Explore →
          </button>
        ) : null}
      </div>
    </a>
  );
}

export default function Home() {
  const { data: session } = useSession();
  // @ts-expect-error custom role on session
  const role: string | undefined = session?.user?.role;
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const [fbCount, setFbCount] = useState<number | null>(null);
  const [siteConfig, setSiteConfig] = useState<null | {
    hero1Url?: string | null;
    hero1Link?: string | null;
    hero2Url?: string | null;
    hero2Link?: string | null;
    hero3Url?: string | null;
    hero3Link?: string | null;
  }>(null);
  const [editHero, setEditHero] = useState<1|2|3|null>(null);
  const [heroUrl, setHeroUrl] = useState("");
  const [heroLink, setHeroLink] = useState("");
  const [savingHero, setSavingHero] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);

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
        const [prodRes, cfgRes] = await Promise.all([
          fetch("/api/products").then(r=>r.json()).catch(()=>null),
          fetch("/api/site-config", { cache: "no-store" }).then(r=>r.json()).catch(()=>null),
        ]);
        if (mounted && prodRes) {
          const list = Array.isArray(prodRes?.products) ? prodRes.products : [];
          const visible = list.filter((p: any) => Number(p?.stockQty ?? 0) > 0);
          setProducts(visible);
        }
        if (mounted && cfgRes && !cfgRes.error) setSiteConfig(cfgRes.config || null);
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

  // Load feedback count for MANAGER
  useEffect(() => {
    let mounted = true;
    if (role === "MANAGER") {
      (async () => {
        try {
          const res = await fetch("/api/feedback?action=count", { cache: "no-store" });
          if (!res.ok) return;
          const j = await res.json();
          if (mounted) setFbCount(typeof j?.count === 'number' ? j.count : null);
        } catch {}
      })();
    } else {
      setFbCount(null);
    }
    return () => { mounted = false; };
  }, [role]);

  // Home page is focused on store products only; removed auth-specific quick actions

  return (
    <div className="min-h-screen text-foreground">
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <section>
          <HeroCard
            imageUrl={siteConfig?.hero1Url || undefined}
            title="منتجات الشركة"
            href={siteConfig?.hero1Link || "/company-products"}
            adminExplore={(role === "ADMIN" || role === "MANAGER")}
            onExplore={() => { setEditHero(1); setHeroUrl(siteConfig?.hero1Url || ""); setHeroLink(siteConfig?.hero1Link || "/company-products"); setHeroError(null); }}
          />
        </section>
        <section>
          <HeroCard
            imageUrl={siteConfig?.hero2Url || undefined}
            title="منتجات إضافية"
            href={siteConfig?.hero2Link || "/extra-products"}
            adminExplore={(role === "ADMIN" || role === "MANAGER")}
            onExplore={() => { setEditHero(2); setHeroUrl(siteConfig?.hero2Url || ""); setHeroLink(siteConfig?.hero2Link || "/extra-products"); setHeroError(null); }}
          />
        </section>
        <section>
          <HeroCard
            imageUrl={siteConfig?.hero3Url || undefined}
            title="عن الشركة"
            href={siteConfig?.hero3Link || "/about"}
            adminExplore={(role === "ADMIN" || role === "MANAGER")}
            onExplore={() => { setEditHero(3); setHeroUrl(siteConfig?.hero3Url || ""); setHeroLink(siteConfig?.hero3Link || "/about"); setHeroError(null); }}
          />
        </section>
        {editHero && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg">
              <div className="px-5 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold">تعديل صورة الواجهة #{editHero}</h3>
                <button onClick={()=>setEditHero(null)} className="text-sm px-2 py-1 rounded-lg border border-black/10 dark:border-white/10">إغلاق</button>
              </div>
              <div className="px-5 py-4 space-y-3 text-right">
                <div>
                  <label className="block text-sm mb-1">رابط الصورة</label>
                  <input value={heroUrl} onChange={(e)=>setHeroUrl(e.target.value)} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm mb-1">رابط الصفحة عند الضغط</label>
                  <input value={heroLink} onChange={(e)=>setHeroLink(e.target.value)} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" placeholder="/company-products" />
                </div>
                {heroError && <div className="text-sm text-red-600">{heroError}</div>}
              </div>
              <div className="px-5 py-3 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2">
                <button onClick={()=>setEditHero(null)} className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm">إلغاء</button>
                <button
                  disabled={savingHero}
                  onClick={async()=>{
                    if (!editHero) return;
                    setSavingHero(true);
                    setHeroError(null);
                    try {
                      const payload: any = {};
                      if (editHero === 1) { payload.hero1Url = heroUrl || null; payload.hero1Link = heroLink || null; }
                      if (editHero === 2) { payload.hero2Url = heroUrl || null; payload.hero2Link = heroLink || null; }
                      if (editHero === 3) { payload.hero3Url = heroUrl || null; payload.hero3Link = heroLink || null; }
                      const res = await fetch('/api/site-config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                      const j = await res.json();
                      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
                      setSiteConfig(j.config || null);
                      setEditHero(null);
                    } catch (e: any) {
                      setHeroError(e?.message || 'فشل حفظ التعديلات');
                    } finally {
                      setSavingHero(false);
                    }
                  }}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 text-sm"
                >{savingHero ? 'جارٍ الحفظ…' : 'حفظ'}</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-black/5 dark:border-white/10 py-8 mt-10">
        <div className="max-w-6xl mx-auto px-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Projection. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
