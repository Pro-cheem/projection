"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

type Media = { id: string; url: string; blurDataUrl?: string };

type Product = {
  id: string;
  name: string;
  capacity: string;
  price: string | number;
  stockQty: number;
  notes?: string | null;
  properties?: Record<string, any> | null;
  images: Media[];
};

type RecentItem = {
  id: string;
  capacity: string;
  price: string | number;
  quantity: number;
  total: string | number;
  invoice: { id: string; serial: string; date: string; customer: { id: string; name: string } };
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [items, setItems] = useState<RecentItem[]>([]);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [propsRows, setPropsRows] = useState<Array<{ key: string; value: string }>>([]);
  const [savingProps, setSavingProps] = useState(false);

  // @ts-expect-error custom role on session
  const role: string | undefined = session?.user?.role;
  const canEdit = useMemo(() => role === "ADMIN" || role === "MANAGER", [role]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/products/${id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setProduct(json.product);
        setNotes(json.product?.notes || "");
        const propsObj = (json.product?.properties || {}) as Record<string, any>;
        const rows = Object.entries(propsObj).map(([k, v]: [string, any]) => ({ key: k, value: String(v ?? "") }));
        setPropsRows(rows);
        setItems(json.recentItems || []);
        setActiveIdx(0);
      } catch (e: any) {
        setError(e?.message || "Server error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {loading ? (
        <div className="space-y-4">
          <div className="h-56 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 animate-pulse" />
          <div className="h-24 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 animate-pulse" />
        </div>
      ) : error ? (
        <div className="text-red-600 dark:text-red-400">{error}</div>
      ) : !product ? (
        <div className="text-muted-foreground">المنتج غير موجود.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden">
                {product.images?.[activeIdx]?.url ? (
                  <Image
                    src={product.images[activeIdx].url}
                    alt={product.name}
                    width={1200}
                    height={400}
                    className="w-full h-64 object-cover"
                    placeholder={product.images[activeIdx].blurDataUrl ? "blur" : undefined}
                    blurDataURL={product.images[activeIdx].blurDataUrl || undefined}
                  />
                ) : (
                  <div className="w-full h-64 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-zinc-800 dark:to-zinc-900" />
                )}
              </div>
              {product.images && product.images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {product.images.map((m, i) => (
                    <button
                      key={m.id}
                      className={`shrink-0 rounded-lg border ${i===activeIdx?"border-blue-500":"border-black/10 dark:border-white/10"} overflow-hidden`}
                      onClick={() => setActiveIdx(i)}
                      aria-label={`عرض الصورة ${i+1}`}
                    >
                      <Image
                        src={m.url}
                        alt={`${product.name} ${i+1}`}
                        width={120}
                        height={80}
                        className="w-24 h-16 object-cover"
                        placeholder={m.blurDataUrl ? "blur" : undefined}
                        blurDataURL={m.blurDataUrl || undefined}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <aside className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
              <h1 className="text-xl font-semibold mb-1">{product.name}</h1>
              <div className="text-sm text-muted-foreground mb-3">السعة: {product.capacity}</div>
              <div className="font-semibold mb-4">{Number(product.price).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
              <div className="text-sm mb-2">المتوفر بالمخزون: {product.stockQty}</div>
              <div className="mt-3">
                <div className="text-sm text-muted-foreground mb-1">ملاحظات</div>
                {canEdit ? (
                  <div>
                    <textarea
                      className="w-full min-h-28 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                      placeholder="اكتب ملاحظات المنتج هنا..."
                      value={notes}
                      onChange={(e)=>setNotes(e.target.value)}
                      maxLength={5000}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        disabled={savingNotes || (notes === (product.notes || ""))}
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 text-sm"
                        onClick={async()=>{
                          if (!id) return;
                          setSavingNotes(true);
                          setError(null);
                          try {
                            const res = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, notes }) });
                            const json = await res.json();
                            if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
                            setProduct(json.product);
                          } catch (e: any) {
                            setError(e?.message || "Failed to save notes");
                          } finally {
                            setSavingNotes(false);
                          }
                        }}
                      >{savingNotes? "جارٍ الحفظ…" : "حفظ الملاحظات"}</button>
                      <button
                        className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm"
                        onClick={()=>setNotes(product?.notes || "")}
                        disabled={savingNotes}
                      >إلغاء</button>
                    </div>
                  </div>
                ) : (
                  product.notes ? <div className="text-sm whitespace-pre-wrap">{product.notes}</div> : <div className="text-sm text-muted-foreground">لا توجد ملاحظات.</div>
                )}
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm text-muted-foreground">خصائص المنتج</div>
                  {canEdit && (
                    <button
                      className="text-xs underline"
                      onClick={()=>setPropsRows((r)=>[...r,{ key: "", value: "" }])}
                    >إضافة خاصية</button>
                  )}
                </div>
                {canEdit ? (
                  <div className="space-y-2">
                    {propsRows.length === 0 && (
                      <div className="text-xs text-muted-foreground">لا توجد خصائص بعد.</div>
                    )}
                    {propsRows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          className="col-span-5 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm"
                          placeholder="المفتاح (مثال: اللون)"
                          value={row.key}
                          onChange={(e)=>setPropsRows(prev=>prev.map((r,i)=> i===idx? { ...r, key: e.target.value }: r))}
                        />
                        <input
                          className="col-span-6 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm"
                          placeholder="القيمة (مثال: أحمر)"
                          value={row.value}
                          onChange={(e)=>setPropsRows(prev=>prev.map((r,i)=> i===idx? { ...r, value: e.target.value }: r))}
                        />
                        <button
                          className="col-span-1 text-red-600 text-sm"
                          onClick={()=>setPropsRows(prev=>prev.filter((_,i)=>i!==idx))}
                          aria-label="حذف"
                        >×</button>
                      </div>
                    ))}
                    <div className="pt-1 text-right">
                      <button
                        disabled={savingProps}
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 text-sm"
                        onClick={async()=>{
                          if (!id) return;
                          setSavingProps(true);
                          setError(null);
                          try {
                            const obj: Record<string,string> = {};
                            for (const r of propsRows) {
                              const k = r.key.trim();
                              if (!k) continue;
                              obj[k] = r.value;
                            }
                            const res = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, properties: obj }) });
                            const json = await res.json();
                            if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
                            setProduct(json.product);
                          } catch (e: any) {
                            setError(e?.message || "Failed to save properties");
                          } finally {
                            setSavingProps(false);
                          }
                        }}
                      >{savingProps? "جارٍ الحفظ…" : "حفظ الخصائص"}</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    {product.properties && Object.keys(product.properties).length > 0 ? (
                      Object.entries(product.properties).map(([k,v]) => (
                        <div key={k} className="flex items-center justify-between gap-3">
                          <div className="text-muted-foreground">{k}</div>
                          <div className="font-medium">{String(v)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">لا توجد خصائص.</div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>

          <section>
            <h2 className="text-lg font-semibold mb-3">آخر الحركات على المنتج</h2>
            <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                  <tr>
                    <th className="text-right p-2">التاريخ</th>
                    <th className="text-right p-2">الفاتورة</th>
                    <th className="text-right p-2">العميل</th>
                    <th className="text-right p-2">السعر</th>
                    <th className="text-right p-2">الكمية</th>
                    <th className="text-right p-2">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="p-3 text-muted-foreground">لا توجد حركات.</td></tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} className="border-t border-black/5 dark:border-white/5">
                        <td className="p-2">{new Date(it.invoice.date).toLocaleDateString()}</td>
                        <td className="p-2">{it.invoice.serial}</td>
                        <td className="p-2">{it.invoice.customer.name}</td>
                        <td className="p-2">{Number(it.price).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</td>
                        <td className="p-2">{it.quantity}</td>
                        <td className="p-2">{Number(it.total).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
