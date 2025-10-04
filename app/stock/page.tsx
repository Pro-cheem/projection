"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { useSession } from "next-auth/react";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  capacity: string;
  price: number | string;
  stockQty: number;
  notes?: string | null;
  images: { id: string; url: string; blurDataUrl?: string }[];
};
export default function StockPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  // @ts-expect-error custom role on session
  const role: string | undefined = session?.user?.role;
  const canEdit = useMemo(() => role === "ADMIN" || role === "MANAGER", [role]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", capacity: "", price: "", stockQty: "", imageUrl: "" });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products");
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok) throw new Error((data && data.error) || "Failed to load products");
      setProducts((data && data.products) || []);
    } catch (e: any) {
      const msg = e.message || "Failed to load";
      setError(msg);
      toast({ title: "خطأ في التحميل", description: msg, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function onRemoveImage(p: Product) {
    try {
      setUploadingId(p.id);
      const res = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, imageUrl: null }) });
      const resText = await res.text();
      let data: any = null;
      try { data = resText ? JSON.parse(resText) : null; } catch {}
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      await load();
      toast({ title: "تم الحذف", description: `تم حذف صورة المنتج ${p.name}`, variant: "success" });
    } catch (e: any) {
      const msg = e.message || "Remove failed";
      setError(msg);
      toast({ title: "فشل حذف الصورة", description: msg, variant: "error" });
    } finally {
      setUploadingId(null);
    }
  }

  async function onUploadImage(p: Product, file: File) {
    try {
      setUploadingId(p.id);
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upText = await up.text();
      let upData: any = null;
      try { upData = upText ? JSON.parse(upText) : null; } catch {}
      if (!up.ok) throw new Error((upData && upData.error) || `Upload failed (HTTP ${up.status})`);
      const imageUrl: string = upData?.url;
      const imageBlurDataUrl: string | undefined = upData?.blurDataUrl;
      if (!imageUrl) throw new Error("No URL returned from upload");
      const res = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, imageUrl, imageBlurDataUrl }) });
      const resText = await res.text();
      let data: any = null;
      try { data = resText ? JSON.parse(resText) : null; } catch {}
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      await load();
      toast({ title: "تم الرفع", description: `تم رفع صورة المنتج ${p.name}`, variant: "success" });
    } catch (e: any) {
      const msg = e.message || "Upload failed";
      setError(msg);
      toast({ title: "فشل رفع الصورة", description: msg, variant: "error" });
    } finally {
      setUploadingId(null);
    }
  }

  useEffect(() => { load(); }, []);

  async function onUpdate(p: Product, patch: { name?: string; capacity?: string; price?: number; stockQty?: number; notes?: string | null }) {
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, ...patch }),
      });
      const resText = await res.text();
      let data: any = null;
      try { data = resText ? JSON.parse(resText) : null; } catch {}
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      await load();
      toast({ title: "تم التحديث", description: `تم حفظ تعديلات المنتج ${p.name}`, variant: "success" });
    } catch (e: any) {
      const msg = e.message || "Update failed";
      setError(msg);
      toast({ title: "فشل الحفظ", description: msg, variant: "error" });
    }
  }

  async function onCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          capacity: form.capacity,
          price: Number(form.price),
          stockQty: Number(form.stockQty || 0),
          imageUrl: form.imageUrl || undefined,
        }),
      });
      const resText = await res.text();
      let data: any = null;
      try { data = resText ? JSON.parse(resText) : null; } catch {}
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      setForm({ name: "", capacity: "", price: "", stockQty: "", imageUrl: "" });
      await load();
      toast({ title: "تمت الإضافة", description: "تم إضافة المنتج بنجاح", variant: "success" });
    } catch (e: any) {
      const msg = e.message || "Failed to create product";
      setError(msg);
      toast({ title: "فشل الإضافة", description: msg, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Stock</h1>
        <a href="/invoice" className="text-sm underline">Back to Invoice</a>
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 p-6 bg-white dark:bg-zinc-900 mb-8">
        <h2 className="font-medium mb-3">Add Product</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <input placeholder="Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
          <input placeholder="Capacity" value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:e.target.value}))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
          <input placeholder="Price" type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
          <input placeholder="Stock Qty" type="number" value={form.stockQty} onChange={e=>setForm(f=>({...f,stockQty:e.target.value}))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
          <input placeholder="Image URL (optional)" value={form.imageUrl} onChange={e=>setForm(f=>({...f,imageUrl:e.target.value}))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={onCreate} disabled={submitting || !form.name || !form.capacity || !form.price} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm">{submitting?"Saving…":"Save"}</button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 animate-pulse">
                <div className="w-full h-36 bg-black/5 dark:bg-white/10 rounded-t-xl" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-2/3 bg-black/5 dark:bg-white/10 rounded" />
                  <div className="h-3 w-1/2 bg-black/5 dark:bg-white/10 rounded" />
                  <div className="h-5 w-1/3 bg-black/5 dark:bg-white/10 rounded" />
                </div>
                {/* Notes placeholder (no product context while loading) */}
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <div className="w-full min-h-24 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 animate-pulse" />
                </div>
              </div>
            ))}
          </>
        ) : products.length === 0 ? (
          <div className="col-span-full text-muted-foreground">No products yet.</div>
        ) : (
          products.map(p => (
            <div key={p.id} className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900">
              <a href={`/products/${p.id}`}>
                {p.images?.[0]?.url ? (
                  <Image
                    src={p.images[0].url}
                    alt={p.name}
                    width={1000}
                    height={144}
                    className="w-full h-36 object-cover rounded-t-xl"
                    placeholder={p.images[0].blurDataUrl ? "blur" : undefined}
                    blurDataURL={p.images[0].blurDataUrl || undefined}
                  />
                ) : (
                  <div className="w-full h-36 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-zinc-800 dark:to-zinc-900 rounded-t-xl" />
                )}
              </a>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Name</div>
                    {canEdit ? (
                      <input
                        className="w-full rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                        defaultValue={p.name}
                        onBlur={(e)=>{
                          const val = e.currentTarget.value.trim();
                          if (val && val !== p.name) onUpdate(p, { name: val });
                        }}
                      />
                    ) : (
                      <a href={`/products/${p.id}`} className="font-medium hover:underline">{p.name}</a>
                    )}
                  </div>
                  <button
                      type="button"
                      className="rounded-lg border border-red-200 text-red-700 hover:bg-red-50 px-3 py-1.5 text-sm"
                      onClick={async()=>{
                        if (!confirm("Delete this product? This cannot be undone.")) return;
                        try {
                          const res = await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
                          const resText = await res.text();
                          let data: any = null;
                          try { data = resText ? JSON.parse(resText) : null; } catch {}
                          if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
                          await load();
                          toast({ title: "تم الحذف", description: `تم حذف المنتج ${p.name}`, variant: "success" });
                        } catch (e:any) {
                          const msg = e.message || "Delete failed";
                          setError(msg);
                          toast({ title: "فشل الحذف", description: msg, variant: "error" });
                        }
                      }}
                    >Delete</button>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground">Capacity</div>
                  {canEdit ? (
                    <input
                      type="text"
                      defaultValue={p.capacity}
                      className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
                      onBlur={(e)=>{
                        const val=e.currentTarget.value.trim();
                        if (val && val !== p.capacity) onUpdate(p, { capacity: val });
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Capacity: {p.capacity}</p>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 items-center">
                  <div className="text-sm">
                    <div className="text-muted-foreground">Price</div>
                    {canEdit ? (
                      <input
                        type="number"
                        defaultValue={Number(p.price)}
                        className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
                        onBlur={(e) => {
                          const val = Number(e.currentTarget.value || 0);
                          if (!isNaN(val) && val !== Number(p.price)) onUpdate(p, { price: val });
                        }}
                      />
                    ) : (
                      <div>{Number(p.price).toLocaleString(undefined, { style: "currency", currency: "EGP" })}</div>
                    )}
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">Stock</div>
                    {canEdit ? (
                      <input
                        type="number"
                        defaultValue={p.stockQty}
                        className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
                        onBlur={(e) => {
                          const val = Number(e.currentTarget.value || 0);
                          if (!isNaN(val) && val !== Number(p.stockQty)) onUpdate(p, { stockQty: val });
                        }}
                      />
                    ) : (
                      <div>{p.stockQty}</div>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="mt-3">
                    <label className="text-xs text-muted-foreground block mb-1">Image</label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`file-${p.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e)=>{
                          const f = e.currentTarget.files?.[0];
                          if (f) onUploadImage(p, f);
                          e.currentTarget.value = "";
                        }}
                      />
                      <label htmlFor={`file-${p.id}`} className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-white/10">
                        {uploadingId === p.id ? "Uploading…" : "Explore…"}
                      </label>
                      {p.images?.[0]?.url && (
                        <>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{p.images[0].url}</span>
                          <button
                            type="button"
                            onClick={() => onRemoveImage(p)}
                            className="rounded-lg border border-red-200 text-red-700 hover:bg-red-50 px-3 py-1.5 text-sm"
                            disabled={uploadingId === p.id}
                          >
                            {uploadingId === p.id ? "Removing…" : "Remove"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
