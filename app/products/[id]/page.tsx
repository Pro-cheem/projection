"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

type Media = { id: string; url: string; blurDataUrl?: string };

// Helpers and PinchZoom component (top-level)
function dist(a: Touch, b: Touch) { const dx = a.clientX - b.clientX; const dy = a.clientY - b.clientY; return Math.hypot(dx, dy); }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function PinchZoom({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const last = useRef({ scale: 1, tx: 0, ty: 0 });
  const startDist = useRef<number | null>(null);
  const panStart = useRef<{ x: number; y: number } | null>(null);

  function applyBounds(nx: number, ny: number, sc: number) {
    const cont = containerRef.current; const img = imgRef.current;
    if (!cont || !img) return { x: nx, y: ny };
    const rect = cont.getBoundingClientRect();
    const maxX = Math.max(0, (img.naturalWidth * sc - rect.width) / 2 + 40);
    const maxY = Math.max(0, (img.naturalHeight * sc - rect.height) / 2 + 40);
    return { x: clamp(nx, -maxX, maxX), y: clamp(ny, -maxY, maxY) };
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      startDist.current = dist(e.touches[0], e.touches[1]);
      last.current = { scale, tx, ty };
    } else if (e.touches.length === 1) {
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      last.current = { scale, tx, ty };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && startDist.current) {
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      const s = clamp((d / startDist.current) * last.current.scale, 1, 4);
      setScale(s);
    } else if (e.touches.length === 1 && panStart.current && scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      const bounded = applyBounds(last.current.tx + dx, last.current.ty + dy, scale);
      setTx(bounded.x); setTy(bounded.y);
    }
  };
  const onTouchEnd = () => {
    if (scale < 1.02) { setScale(1); setTx(0); setTy(0); last.current = { scale: 1, tx: 0, ty: 0 }; }
    else { const b = applyBounds(tx, ty, scale); setTx(b.x); setTy(b.y); last.current = { scale, tx: b.x, ty: b.y }; }
    startDist.current = null; panStart.current = null;
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden select-none" style={{ touchAction: "none" }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <img ref={imgRef} src={src} alt={alt} className="max-w-full h-auto mx-auto"
        style={{ transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`, transformOrigin: "center center", willChange: "transform" }} />
      {scale > 1 && (
        <button type="button" className="absolute top-2 left-2 rounded-md bg-black/60 text-white text-xs px-2 py-1"
          onClick={() => { setScale(1); setTx(0); setTy(0); last.current = { scale: 1, tx: 0, ty: 0 }; }}>
          إعادة الضبط
        </button>
      )}
    </div>
  );
}

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
  const params = useParams();
  const id = (params as any)?.id as string | undefined;
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
  const [featuresText, setFeaturesText] = useState<string>("");
  const [usageText, setUsageText] = useState<string>("");
  const [compositionText, setCompositionText] = useState<string>("");

  // @ts-expect-error custom role on session
  const role: string | undefined = session?.user?.role;
  const canEdit = useMemo(() => role === "ADMIN" || role === "MANAGER", [role]);
  const canEditProps = useMemo(() => role === "MANAGER", [role]);
  const canViewMovements = useMemo(() => role === "MANAGER", [role]);

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
        setFeaturesText(typeof propsObj.features === 'string' ? propsObj.features : "");
        setUsageText(typeof propsObj.usage === 'string' ? propsObj.usage : "");
        setCompositionText(typeof propsObj.composition === 'string' ? propsObj.composition : "");
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
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-2">
                {product.images?.[activeIdx]?.url ? (
                  <PinchZoom src={product.images[activeIdx].url} alt={product.name} />
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
                  <div className="text-sm text-muted-foreground">بيانات المنتج</div>
                  {canEditProps && (
                    <button
                      className="text-xs underline"
                      onClick={()=>setPropsRows((r)=>[...r,{ key: "", value: "" }])}
                    >إضافة خاصية</button>
                  )}
                </div>
                {canEditProps ? (
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-black/10 dark:border-white/10">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-base font-semibold">التركيب</span>
                      </div>
                      <textarea
                        className="w-full min-h-20 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                        placeholder="اكتب التركيب مثل: N 20%\nP 20%\nK 20%"
                        value={compositionText}
                        onChange={(e)=>setCompositionText(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-black/10 dark:border-white/10">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-base font-semibold">الخصائص</span>
                      </div>
                      <textarea
                        className="w-full min-h-28 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                        placeholder="اكتب الخصائص هنا…"
                        value={featuresText}
                        onChange={(e)=>setFeaturesText(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-black/10 dark:border-white/10">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-base font-semibold">معدلات الاستخدام</span>
                      </div>
                      <textarea
                        className="w-full min-h-28 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                        placeholder="اكتب معدلات وطريقة الاستخدام (رش ورقي/مع مياه الري…)"
                        value={usageText}
                        onChange={(e)=>setUsageText(e.target.value)}
                      />
                    </div>
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
                            if (compositionText.trim()) obj["composition"] = compositionText.trim(); else delete obj["composition"];
                            if (featuresText.trim()) obj["features"] = featuresText.trim(); else delete obj["features"];
                            if (usageText.trim()) obj["usage"] = usageText.trim(); else delete obj["usage"];
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
                  <div className="space-y-3 text-sm">
                    {/* التركيب */}
                    {(product.properties?.composition || product.properties?.N || product.properties?.P || product.properties?.K) ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2 pb-1 border-b border-black/10 dark:border-white/10">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="text-base font-semibold">التركيب</span>
                        </div>
                        {product.properties?.composition ? (
                          <ul className="list-disc list-inside space-y-1">
                            {String(product.properties.composition)
                              .split(/\r?\n/)
                              .map((l)=>l.trim())
                              .filter((l)=>l.length>0)
                              .map((l, i)=>{
                                const m = l.match(/^\s*([A-Za-z\u0600-\u06FF]+)\s*:?\s*(\d+(?:[.,]\d+)?)%?\s*$/);
                                if (m) {
                                  const el = m[1];
                                  const pct = m[2].replace(',', '.');
                                  return (
                                    <li key={i} className="flex items-center justify-between gap-4">
                                      <span>{el}</span>
                                      <span className="font-medium">{pct}%</span>
                                    </li>
                                  );
                                }
                                return (<li key={i}>{l}</li>);
                              })}
                          </ul>
                        ) : (
                          <ul className="list-disc list-inside space-y-1">
                            {[
                              product.properties?.K ? { k: 'K', v: String(product.properties.K) } : null,
                              product.properties?.P ? { k: 'P', v: String(product.properties.P) } : null,
                              product.properties?.N ? { k: 'N', v: String(product.properties.N) } : null,
                            ].filter(Boolean).map((item:any, i:number)=>{
                              const m = String(item.v).match(/^(\d+(?:[.,]\d+)?)%?$/);
                              const pct = m ? m[1].replace(',', '.') : String(item.v);
                              return (
                                <li key={i} className="flex items-center justify-between gap-4">
                                  <span>{item.k}</span>
                                  <span className="font-medium">{pct}{m? '%':''}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                    {product.properties?.features ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2 pb-1 border-b border-black/10 dark:border-white/10">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="text-base font-semibold">الخصائص</span>
                        </div>
                        <ul className="list-disc list-inside leading-relaxed space-y-1">
                          {String(product.properties.features)
                            .split(/\r?\n/)
                            .map((l)=>l.trim())
                            .filter((l)=>l.length>0)
                            .map((l, i)=> (<li key={i}>{l}</li>))}
                        </ul>
                      </div>
                    ) : null}
                    {product.properties?.usage ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2 pb-1 border-b border-black/10 dark:border-white/10">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="text-base font-semibold">معدلات الاستخدام</span>
                        </div>
                        <ul className="list-disc list-inside leading-relaxed space-y-1">
                          {String(product.properties.usage)
                            .split(/\r?\n/)
                            .map((l)=>l.trim())
                            .filter((l)=>l.length>0)
                            .map((l, i)=> (<li key={i}>{l}</li>))}
                        </ul>
                      </div>
                    ) : null}
                    {/* عرض باقي الخصائص كمفاتيح/قيم */}
                    {product.properties && Object.keys(product.properties).filter(k=> k!=="features" && k!=="usage").length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(product.properties).filter(([k])=>k!=="features" && k!=="usage" && k!=="composition" && k!=="N" && k!=="P" && k!=="K").map(([k,v]) => (
                          <div key={k} className="flex items-center justify-between gap-3">
                            <div className="text-muted-foreground">{k}</div>
                            <div className="font-medium">{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (!product.properties?.features && !product.properties?.usage ? (
                      <div className="text-sm text-muted-foreground">لا توجد خصائص.</div>
                    ) : null)}
                  </div>
                )}
              </div>
            </aside>
          </div>

          {canViewMovements && (
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
          )}
        </>
      )}
    </div>
  );
}
