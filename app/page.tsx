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

function HeroCard({ imageUrl, title, href, adminExplore }: { imageUrl?: string; title: string; href: string; adminExplore?: boolean }) {
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
          <span className="inline-block rounded-lg bg-white/90 text-zinc-900 px-3 py-1.5 text-sm shadow-sm group-hover:bg-white transition">Explore →</span>
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
          />
        </section>
        <section>
          <HeroCard
            imageUrl={siteConfig?.hero2Url || undefined}
            title="منتجات إضافية"
            href={siteConfig?.hero2Link || "/extra-products"}
            adminExplore={(role === "ADMIN" || role === "MANAGER")}
          />
        </section>
        <section>
          <HeroCard
            imageUrl={siteConfig?.hero3Url || undefined}
            title="عن الشركة"
            href={siteConfig?.hero3Link || "/about"}
            adminExplore={(role === "ADMIN" || role === "MANAGER")}
          />
        </section>
      </main>

      <footer className="border-t border-black/5 dark:border-white/10 py-8 mt-10">
        <div className="max-w-6xl mx-auto px-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Projection. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
