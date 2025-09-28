"use client";

import AuthBar from "@/components/auth-bar";
import dynamic from 'next/dynamic';

// تحميل مكون الطقس ديناميكيًا مع تعطيل SSR
const Weather = dynamic(() => import('@/components/weather-new'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full">
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      <span className="text-sm text-white">جاري التحميل...</span>
    </div>
  ),
});
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

    return () => clearInterval(timer);
  }, []);
  return (
    <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/80 dark:bg-black/50 border-b border-black/5 dark:border-white/10">
      <div className="w-full bg-gradient-to-r from-green-700 to-emerald-800 py-2 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="/" className="flex items-center">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
              ) : (
                <span className="text-2xl font-bold text-white">الطريق نحو الأفضل</span>
              )}
            </a>
            <div className="hidden md:flex items-center gap-2 text-white/90 text-sm">
              <span className="hidden lg:inline">جودة • استدامة • تطور</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <Weather />
            {isClient && currentTime && (
              <div className="hidden md:flex flex-col items-end border-r border-white/20 pr-6">
                <div className="text-white text-sm font-medium">{formatDate(currentTime)}</div>
                <div className="text-white/90 text-xs">{formatTime(currentTime)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <nav className="hidden sm:flex gap-2 text-sm">
            <a href="/shop" className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white">Shop</a>
            <a href="/cart" className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-1.5 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-white">Cart</a>
            {session && (
              <>
                {/* @ts-expect-error custom role */}
                {((session.user as any)?.role === 'EMPLOYEE' || (session.user as any)?.role === 'MANAGER' || (session.user as any)?.role === 'ADMIN') && (
                  <a href="/invoice" className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5">New Invoice</a>
                )}
                {/* @ts-expect-error custom role */}
                {((session.user as any)?.role === 'MANAGER' || (session.user as any)?.role === 'ADMIN') && (
                  <>
                    <a href="/stock" className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5">Stock</a>
                    <a href="/journal" className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5">Journal</a>
                    <a href="/customers" className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5">Customers</a>
                    <a href="/reports" className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5">Reports</a>
                    <a href="/admin/users" className="rounded-lg bg-purple-700 hover:bg-purple-800 text-white px-3 py-1.5">Users</a>
                    <a href="/settings" className="rounded-lg bg-zinc-800 hover:bg-zinc-900 text-white px-3 py-1.5">Settings</a>
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
