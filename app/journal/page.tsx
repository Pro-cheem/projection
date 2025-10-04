"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";

type Entry = {
  id: string;
  date: string;
  invoice: { serial: string } | null;
  customer: { id: string; name: string } | null;
  user: { id: string; name: string | null; email: string | null } | null;
  total: string | number;
  collection: string | number;
  balance: string | number;
};

export default function JournalPage() {
  const { data: session } = useSession();
  // @ts-expect-error role on session
  const role: string | undefined = session?.user?.role;
  const canEdit = useMemo(() => role === "ADMIN" || role === "MANAGER", [role]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [totals, setTotals] = useState({ total: 0, collection: 0, balance: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const lastEntryRef = useRef<HTMLDivElement>(null);
  const egpFmt = useMemo(() => new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP" }), []);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  async function openDetails(id: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const res = await fetch(`/api/journal/${id}`);
      const data = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setDetail(data);
    } catch (e:any) {
      setDetailError(e.message || "Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  }

  const loadEntries = useCallback(async (pageNum: number = 1, isInitialLoad: boolean = false): Promise<boolean> => {
    if (loadingRef.current) return false;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // إنشاء معلمات البحث
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '50' // تحميل 50 سجل في كل مرة
      });
      
      // معالجة تاريخ البداية
      if (from) {
        try {
          const fromDate = new Date(from);
          if (!isNaN(fromDate.getTime())) {
            params.set("from", fromDate.toISOString());
          }
        } catch (e) {
          console.error("Invalid from date:", e);
        }
      }
      
      // معالجة تاريخ النهاية
      if (to) {
        try {
          const toDate = new Date(to);
          if (!isNaN(toDate.getTime())) {
            // تعيين الوقت إلى نهاية اليوم
            toDate.setHours(23, 59, 59, 999);
            params.set("to", toDate.toISOString());
          }
        } catch (e) {
          console.error("Invalid to date:", e);
        }
      }
      
      // جلب البيانات من API
      const apiUrl = `/api/journal?${params.toString()}`;
      console.log("Fetching journal data from:", apiUrl);
      
      const res = await fetch(apiUrl, {
        next: { revalidate: 0 } // تعطيل التخزين المؤقت
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("API Error:", { status: res.status, errorData });
        throw new Error(errorData?.error || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      // تحقق من صحة البيانات المستلمة
      const validEntries = (data.entries || []).filter((e: any) => {
        const isValid = e && e.id && e.date && (e.invoice || e.customer);
        if (!isValid) {
          console.warn("Invalid journal entry:", e);
        }
        return isValid;
      });
      
      console.log(`Loaded ${validEntries.length} valid journal entries`);
      
      // تحديث الحالة بناءً على ما إذا كانت هذه هي التحميلة الأولى أم لا
      setEntries(prevEntries => isInitialLoad ? validEntries : [...prevEntries, ...validEntries]);
      
      // تحديث المجاميع
      if (isInitialLoad) {
        const calculatedTotals = validEntries.reduce((acc: any, entry: any) => ({
          total: acc.total + (Number(entry.total) || 0),
          collection: acc.collection + (Number(entry.collection) || 0),
          balance: acc.balance + (Number(entry.balance) || 0)
        }), { total: 0, collection: 0, balance: 0 });
        
        setTotals(calculatedTotals);
      } else {
        // تحديث المجاميع بشكل تدريجي (بدون الاعتماد على متغير totals الخارجي)
        setTotals(prev => validEntries.reduce((acc: any, entry: any) => ({
          total: acc.total + (Number(entry.total) || 0),
          collection: acc.collection + (Number(entry.collection) || 0),
          balance: acc.balance + (Number(entry.balance) || 0)
        }), { ...prev }));
      }
      
      // التحقق مما إذا كان هناك المزيد من الصفحات
      setHasMore(validEntries.length >= 50);
      return validEntries.length > 0;
      
    } catch (e: any) {
      console.error("Error loading journal:", e);
      setError(e.message || "Failed to load journal. Please try again.");
      return false;
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [from, to]);

  // تحميل البيانات الأولية
  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      try {
        await loadEntries(1, true);
      } catch (error) {
        console.error("Error in loadInitialData:", error);
      }
    };
    
    if (isMounted) {
      loadInitialData().catch(console.error);
    }
    
    // تنظيف عند إغلاق المكون
    return () => {
      isMounted = false;
      loadingRef.current = false;
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [from, to, loadEntries]); // إضافة التبعيات المطلوبة
  
  // إعداد Intersection Observer للتحميل التلقائي
  useEffect(() => {
    if (!hasMore || loading) return;
    
    const currentObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadEntries(page + 1, false).then(hasMoreData => {
            if (hasMoreData) {
              setPage(p => p + 1);
            }
          });
        }
      },
      { threshold: 0.1 }
    );
    
    if (lastEntryRef.current) {
      currentObserver.observe(lastEntryRef.current);
    }
    
    observer.current = currentObserver;
    
    return () => {
      if (currentObserver) {
        currentObserver.disconnect();
      }
    };
  }, [hasMore, loading, page, loadEntries]);
  
  // إعادة تحميل البيانات عند تغيير عوامل التصفية مع تأخير (بدون lodash)
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      loadEntries(1, true);
    }, 500);
    return () => clearTimeout(t);
  }, [from, to, loadEntries]);

  async function saveCollection(id: string) {
    const val = Number(editing[id] ?? "");
    if (Number.isNaN(val) || val < 0) {
      setError("قيمة التحصيل غير صالحة. الرجاء إدخال رقم موجب.");
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      console.log(`Updating collection for entry ${id} to ${val}`);
      
      const response = await fetch(`/api/journal/${id}`, { 
        method: "PATCH", 
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        }, 
        body: JSON.stringify({ collection: val })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error:", { status: response.status, errorData });
        throw new Error(errorData?.error || `حدث خطأ في الخادم (${response.status})`);
      }
      
      const data = await response.json();
      console.log("Update successful:", data);
      setEditing(prev => { const c = { ...prev }; delete c[id]; return c; });
      await loadEntries(1, true);
    } catch (e: any) {
      setError(e.message || "Failed to update");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* رسائل الحالة */}
      {loading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-lg font-medium">جاري التحميل...</span>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-200 rounded-r">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">خطأ:</span>
          </div>
          <p className="mt-1 text-sm">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-700 dark:text-red-300 hover:underline"
          >
            إغلاق
          </button>
        </div>
      )}
      
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Journal</h1>
        <a href="/invoice" className="text-sm underline">Back to Invoice</a>
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 p-6 bg-white dark:bg-zinc-900 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm mb-1">من تاريخ</label>
            <input 
              type="date" 
              value={from} 
              onChange={e => setFrom(e.target.value)}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" 
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">إلى تاريخ</label>
            <input 
              type="date" 
              value={to} 
              onChange={e => setTo(e.target.value)} 
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              dir="ltr"
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => {
                setPage(1);
                loadEntries(1, true);
              }} 
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 w-full"
              disabled={loading}
            >
              {loading ? 'جاري التحميل...' : 'تطبيق'}
            </button>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => {
                setFrom('');
                setTo('');
                setPage(1);
                loadEntries(1, true);
              }}
              className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
            >
              مسح الفلتر
            </button>
          </div>
        </div>
      </div>
      {/* Details Modal */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-3xl w-full mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
              <div className="font-semibold">تفاصيل الفاتورة</div>
              <button className="text-sm" onClick={() => setDetailOpen(false)}>إغلاق</button>
            </div>
            <div className="p-4">
              {detailLoading ? (
                <div className="text-sm">جاري التحميل…</div>
              ) : detailError ? (
                <div className="text-sm text-red-600">{detailError}</div>
              ) : !detail ? (
                <div className="text-sm text-muted-foreground">لا يوجد بيانات</div>
              ) : !detail.invoice ? (
                <div className="text-sm text-muted-foreground">لا توجد فاتورة مرتبطة بهذا القيد.</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>التاريخ: {new Date(detail.invoice.date).toLocaleDateString('ar-EG')}</div>
                    <div>رقم الفاتورة: {detail.invoice.serial}</div>
                    <div>العميل: {detail.invoice.customer?.name || '-'}</div>
                    <div>المستخدم: {detail.invoice.user?.name || detail.invoice.user?.email || '-'}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-black/10 dark:border-white/10">
                      <thead>
                        <tr className="bg-black/5 dark:bg-white/10">
                          <th className="text-left px-2 py-1">المنتج</th>
                          <th className="text-left px-2 py-1">السعة</th>
                          <th className="text-right px-2 py-1">السعر</th>
                          <th className="text-right px-2 py-1">الكمية</th>
                          <th className="text-right px-2 py-1">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.invoice.items.map((it:any)=> (
                          <tr key={it.id} className="border-t border-black/10 dark:border-white/10">
                            <td className="px-2 py-1">{it.productName}</td>
                            <td className="px-2 py-1">{it.capacity}</td>
                            <td className="px-2 py-1 text-right">{egpFmt.format(Number(it.price))}</td>
                            <td className="px-2 py-1 text-right">{it.quantity}</td>
                            <td className="px-2 py-1 text-right">{egpFmt.format(Number(it.total))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-6 justify-end text-sm font-medium">
                    <div>إجمالي الفاتورة: <span className="font-semibold">{egpFmt.format(Number(detail.invoice.total))}</span></div>
                    <div>التحصيل: <span className="font-semibold">{egpFmt.format(Number(detail.invoice.collection))}</span></div>
                    <div>المتبقي: <span className="font-semibold">{egpFmt.format(Number(detail.invoice.balance))}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm font-medium border-b border-black/10 dark:border-white/10">
          <div className="col-span-2 flex items-center">
            Date
            <button 
              onClick={() => {
                setFrom('');
                setTo('');
                loadEntries(1, true);
              }}
              className="ml-2 text-xs text-gray-500 hover:text-gray-700"
              title="Clear date filters"
            >
              Clear
            </button>
          </div>
          <div className="col-span-2">Invoice</div>
          <div className="col-span-3">Customer</div>
          <div className="col-span-1 text-right">Total</div>
          <div className="col-span-1 text-right">Collected</div>
          <div className="col-span-1 text-right">Balance</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading journal entries...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No entries</div>
        ) : (
          entries.map((e, index) => {
            // إنشاء مرجع للعنصر الأخير للتحميل التلقائي
            const isLastEntry = index === entries.length - 1;
            
            return (
              <div 
                ref={isLastEntry ? lastEntryRef : null}
                className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-black/5 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors" 
                key={e.id}
              >
                {/* التاريخ */}
                <div className="col-span-2 text-sm">
                  {new Date(e.date).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </div>
                {/* رقم الفاتورة */}
                <div className="col-span-2 text-sm truncate" title={e.invoice?.serial || ""}>
                  {e.invoice?.serial ? (
                    <button
                      className="underline hover:text-blue-700"
                      onClick={() => openDetails(e.id)}
                      title="عرض تفاصيل الفاتورة"
                    >
                      {e.invoice.serial}
                    </button>
                  ) : (
                    "-"
                  )}
                </div>
                <div className="col-span-2 text-sm truncate" title={e.customer?.name || ""}>
                  {e.customer?.name || "-"}
                </div>
                <div className="col-span-2 text-sm truncate" title={e.user?.name || e.user?.email || ""}>
                  {e.user?.name || e.user?.email || "-"}
                </div>
                <div className="col-span-1 text-right text-sm font-medium">
                  {egpFmt.format(Number(e.total))}
                </div>
                <div className="col-span-1 text-right text-sm">
                  {canEdit ? (
                    <div className="flex items-center gap-2 justify-end">
                      <input
                        type="number"
                        defaultValue={Number(e.collection)}
                        onChange={(ev) => setEditing(prev => ({ ...prev, [e.id]: ev.target.value }))}
                        className="w-24 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-2 py-1 text-right text-sm"
                        min="0"
                        step="0.01"
                      />
                      <button 
                        onClick={() => saveCollection(e.id)} 
                        className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 text-xs whitespace-nowrap"
                        disabled={loading}
                      >
                        حفظ
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium">{egpFmt.format(Number(e.collection))}</span>
                  )}
                </div>
                <div className="col-span-1 text-right text-sm font-medium">
                  {egpFmt.format(Number(e.balance))}
                </div>
              </div>
            );
          })
        )}
        <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-black/10 dark:border-white/10">
          <div className="flex justify-end gap-6 px-4 py-3 text-sm font-medium bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
            <div className="font-bold">الإجمالي: <span className="text-blue-600 dark:text-blue-400">{egpFmt.format(Number(totals.total))}</span></div>
            <div className="font-bold">المحصل: <span className="text-emerald-600 dark:text-emerald-400">{egpFmt.format(Number(totals.collection))}</span></div>
            <div className="font-bold">المتبقي: <span className={Number(totals.balance) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}>
              {egpFmt.format(Number(totals.balance))}
            </span></div>
          </div>
          
          {hasMore && (
            <div className="text-center py-2 text-sm text-gray-500 dark:text-gray-400">
              جاري تحميل المزيد من السجلات...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
