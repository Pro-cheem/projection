"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";

export default function SettingsForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [hero1Url, setHero1Url] = useState<string | null>(null);
  const [hero2Url, setHero2Url] = useState<string | null>(null);
  const [hero3Url, setHero3Url] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [mediaRes, configRes] = await Promise.all([
        fetch("/api/media", { cache: "no-store" }),
        fetch("/api/site-config", { cache: "no-store" })
      ]);

      const mediaData = await mediaRes.json();
      const configData = await configRes.json();

      if (!mediaRes.ok) throw new Error(mediaData.error || `HTTP ${mediaRes.status}`);
      if (!configRes.ok) throw new Error(configData.error || `HTTP ${configRes.status}`);

      setLogo(mediaData.logo || null);
      setBackground(mediaData.background || null);
      setHero1Url(configData.config?.hero1Url || null);
      setHero2Url(configData.config?.hero2Url || null);
      setHero3Url(configData.config?.hero3Url || null);
    } catch (e: any) {
      const msg = e.message || "Failed to load settings";
      setError(msg);
      toast({ title: "فشل تحميل الإعدادات", description: msg, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onUpload(kind: "LOGO" | "BACKGROUND", file: File) {
    setError(null);
    setSaving(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || `Upload HTTP ${up.status}`);

      const url = upData?.url;
      if (!url) throw new Error("No URL returned from upload");

      const set = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, url })
      });
      const setData = await set.json();
      if (!set.ok) throw new Error(setData.error || `Media HTTP ${set.status}`);

      await load();
      toast({
        title: kind === "LOGO" ? "تم تحديث الشعار" : "تم تحديث الخلفية",
        description: "تم الحفظ بنجاح",
        variant: "success"
      });
    } catch (e: any) {
      const msg = e.message || "Failed to save";
      setError(msg);
      toast({ title: "فشل الحفظ", description: msg, variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function onHeroUpload(heroNumber: 1 | 2 | 3, file: File) {
    setError(null);
    setSaving(`hero${heroNumber}`);
    try {
      const fd = new FormData();
      fd.append("heroNumber", heroNumber.toString());
      fd.append("file", file);

      const res = await fetch("/api/hero-upload", {
        method: "POST",
        body: fd
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Upload HTTP ${res.status}`);

      await load();
      toast({
        title: `تم تحديث صورة الواجهة ${heroNumber}`,
        description: "تم الحفظ بنجاح",
        variant: "success"
      });
    } catch (e: any) {
      const msg = e.message || "فشل في الحفظ";
      setError(msg);
      toast({ title: "فشل الحفظ", description: msg, variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function onHeroDelete(heroNumber: 1 | 2 | 3) {
    setError(null);
    setSaving(`delete-hero${heroNumber}`);

    if (!confirm(`هل أنت متأكد من حذف صورة الواجهة ${heroNumber}؟`)) {
      setSaving(null);
      return;
    }

    try {
      const res = await fetch("/api/hero-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroNumber: heroNumber.toString() })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Delete HTTP ${res.status}`);

      await load();
      toast({
        title: `تم حذف صورة الواجهة ${heroNumber}`,
        description: "تم الحذف بنجاح",
        variant: "success"
      });
    } catch (e: any) {
      const msg = e.message || "فشل في الحذف";
      setError(msg);
      toast({ title: "فشل الحذف", description: msg, variant: "error" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold mb-6">الإعدادات</h1>
      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">جارٍ التحميل…</div>
      ) : (
        <div className="space-y-6">
          {/* Hero Images Section */}
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-6 bg-white dark:bg-zinc-900">
            <h2 className="font-medium mb-4">صور الواجهة الرئيسية</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((num) => {
                const url = num === 1 ? hero1Url : num === 2 ? hero2Url : hero3Url;
                return (
                  <div key={num} className="space-y-2">
                    <div className="text-sm font-medium">صورة الواجهة {num}</div>
                    <div className="mb-3">
                      {url ? (
                        <img
                          src={url}
                          alt={`Hero ${num}`}
                          className="h-24 w-full object-cover rounded"
                        />
                      ) : (
                        <div className="h-24 w-full bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-sm text-muted-foreground">
                          لا توجد صورة
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="w-full inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.currentTarget.files?.[0];
                            if (f) onHeroUpload(num as 1 | 2 | 3, f);
                            e.currentTarget.value = "";
                          }}
                        />
                        {saving === `hero${num}` ? "جارٍ الحفظ…" : "تحميل الصورة"}
                      </label>
                      {url && (
                        <button
                          onClick={() => onHeroDelete(num as 1 | 2 | 3)}
                          disabled={saving === `delete-hero${num}`}
                          className="w-full rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 text-sm hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
                        >
                          {saving === `delete-hero${num}` ? "جارٍ الحذف…" : "حذف الصورة"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Logo and Background Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-black/10 dark:border-white/10 p-6 bg-white dark:bg-zinc-900">
              <h2 className="font-medium mb-3">الشعار</h2>
              <div className="mb-3">
                {logo ? (
                  <img src={logo} alt="Logo" className="h-16 object-contain" />
                ) : (
                  <div className="text-sm text-muted-foreground">لا يوجد شعار محدد</div>
                )}
              </div>
              <label className="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) onUpload("LOGO", f);
                    e.currentTarget.value = "";
                  }}
                />
                {saving === "LOGO" ? "جارٍ الحفظ…" : "تحميل الشعار"}
              </label>
            </div>

            <div className="rounded-xl border border-black/10 dark:border-white/10 p-6 bg-white dark:bg-zinc-900">
              <h2 className="font-medium mb-3">الخلفية</h2>
              <div className="mb-3">
                {background ? (
                  <img src={background} alt="Background" className="h-24 w-full object-cover rounded" />
                ) : (
                  <div className="text-sm text-muted-foreground">لا توجد خلفية محددة</div>
                )}
              </div>
              <label className="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) onUpload("BACKGROUND", f);
                    e.currentTarget.value = "";
                  }}
                />
                {saving === "BACKGROUND" ? "جارٍ الحفظ…" : "تحميل الخلفية"}
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
