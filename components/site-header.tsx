"use client";

import AuthBar from "@/components/auth-bar";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date);
}

export default function SiteHeader() {
  const { data: session } = useSession();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [ordersPending, setOrdersPending] = useState(0);
  useEffect(() => {
    // Set isClient to true once component mounts (client-side only)
    setIsClient(true);
    setCurrentTime(new Date());

    (async () => {
      try {
        const res = await fetch("/api/media", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) setLogoUrl(data.logo || null);
      } catch {}
    })();

    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Cart count sync
    const readCart = () => {
      try {
        const raw = window.localStorage.getItem("cart");
        const items = raw ? JSON.parse(raw) as Array<{ qty: number }> : [];
        const count = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
        setCartCount(count);
      } catch { setCartCount(0); }
    };
    readCart();
    const onUpdateCart = () => readCart();
    window.addEventListener("cart:updated", onUpdateCart);
    window.addEventListener("storage", onUpdateCart);

    // Orders pending count sync
    const readOrders = () => {
      try {
        const raw = window.localStorage.getItem("orders");
        const list: Array<{ status?: string }> = raw ? JSON.parse(raw) : [];
        const pending = list.filter(o => (o?.status || "pending") === "pending").length;
        setOrdersPending(pending);
      } catch { setOrdersPending(0); }
    };
    readOrders();
    const onUpdateOrders = () => readOrders();
    window.addEventListener("orders:updated", onUpdateOrders);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener("cart:updated", onUpdateCart);
      window.removeEventListener("storage", onUpdateCart);
      window.removeEventListener("orders:updated", onUpdateOrders);
    };
  }, []);
  return (
    <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/80 dark:bg-black/50 border-b border-black/5 dark:border-white/10">
      <div className="w-full bg-gradient-to-r from-green-700 to-emerald-800 px-0">
        <div className="max-w-7xl mx-auto w-full relative">
          <a href="/" aria-label="Logo" className="block">
            {logoUrl ? (
              <div
                className="w-full h-28 md:h-40 bg-center bg-no-repeat bg-cover"
                style={{ backgroundImage: `url(${logoUrl})` }}
              />
            ) : (
              <div className="w-full h-20 md:h-28 flex items-center justify-center">
                <span className="text-2xl md:text-3xl font-bold text-white">الطريق نحو الأفضل</span>
              </div>
            )}
          </a>
          {/* overlay */}
          <div className="absolute inset-0 bg-black/25 pointer-events-none" />
          {/* clock on banner */}
          {isClient && currentTime && (
            <div className="absolute right-4 top-3 hidden md:flex flex-col items-end text-white drop-shadow">
              <div className="text-sm font-medium">{formatDate(currentTime)}</div>
              <div className="text-xs text-white/90">{formatTime(currentTime)}</div>
            </div>
          )}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <nav className="hidden sm:flex gap-2 text-sm">
            <a href="/orders" className="relative rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white">
              الطلبات
              {ordersPending > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[1.25rem] h-5 px-1 rounded-full bg-amber-600 text-white text-[11px] leading-5 text-center">
                  {ordersPending}
                </span>
              )}
            </a>
            <a href="/cart" className="relative rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white">
              العربة
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[1.25rem] h-5 px-1 rounded-full bg-emerald-600 text-white text-[11px] leading-5 text-center">
                  {cartCount}
                </span>
              )}
            </a>
            {/* Employee quick links */}
            {session && ((session.user as any)?.role === 'EMPLOYEE') && (
              <>
                <a href={`/reps/${(session.user as any)?.id || ''}`} className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white">معاملات المندوب</a>
                <a href="/reports" className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white">التقارير</a>
              </>
            )}
            {session && (
              <>
                {((session.user as any)?.role === 'EMPLOYEE' || (session.user as any)?.role === 'MANAGER' || (session.user as any)?.role === 'ADMIN') && (
                  <a href="/invoice" className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5">فاتورة جديدة</a>
                )}
                {((session.user as any)?.role === 'MANAGER' || (session.user as any)?.role === 'ADMIN') && (
                  <>
                    <a href="/stock" className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5">المخزون</a>
                    <a href="/journal" className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5">اليومية</a>
                    <a href="/customers" className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5">العملاء</a>
                    <a href="/admin/users" className="rounded-lg bg-purple-700 hover:bg-purple-800 text-white px-3 py-1.5">المستخدمون</a>
                    <a href="/settings" className="rounded-lg bg-zinc-800 hover:bg-zinc-900 text-white px-3 py-1.5">الإعدادات</a>
                  </>
                )}
              </>
            )}
          </nav>
        </div>
        <AuthBar />
      </div>
    </header>
  );
}
