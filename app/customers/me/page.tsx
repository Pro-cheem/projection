"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MyCustomerRedirectPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/customers/me", { cache: "no-store" });
        const data = await res.json().catch(()=>null);
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (mounted) router.replace(`/customers/${data.id}`);
      } catch (e:any) {
        if (mounted) setError(e?.message || "تعذر تحديد حساب العميل");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحويل إلى صفحتك…</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  return null;
}
