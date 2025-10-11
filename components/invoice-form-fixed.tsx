"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  capacity: string;
  price: string; // serialized Decimal
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalDebt: string; // serialized Decimal
};

type Line = {
  productId: string;
  capacity: string;
  price: number;
  quantity: number;
};

export default function InvoiceForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [serial, setSerial] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState("");
  const [collection, setCollection] = useState(0);
  const [lines, setLines] = useState<Line[]>([{ productId: "", capacity: "", price: 0, quantity: 1 }]);

  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "" });
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    
    (async () => {
      try {
        const [proRes, cusRes] = await Promise.all([
          fetch("/api/products").then(res => res.json()),
          fetch("/api/customers").then(res => res.json())
        ]);

        if (mounted) {
          if (proRes.error) throw new Error(proRes.error);
          if (cusRes.error) throw new Error(cusRes.error);
          
          // تحقق من صحة بيانات المنتجات
          const validProducts = (proRes.products || []).filter((p: any) => 
            p && p.id && p.name && typeof p.price !== 'undefined'
          );
          
          setProducts(validProducts.map((p: any) => ({
            id: p.id,
            name: p.name,
            capacity: p.capacity || '',
            price: String(Number(p.price) || 0)
          })));
          
          // تحقق من صحة بيانات العملاء
          const validCustomers = (cusRes.customers || []).filter((c: any) => c && c.id && c.name);
          setCustomers(validCustomers);
          
          // ملاحظة: نُبقي النموذج قابلًا للاستخدام حتى لو لم توجد منتجات،
          // للسماح بإنشاء فواتير "تحصيل فقط" بدون أصناف.
        }
      } catch (e: any) {
        if (mounted) setError(e.message || "Failed to load data");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    
    // If serial is empty, auto-generate a default serial like INV-YYYYMMDD-HHMMSS
    if (!serial) {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const s = `INV-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      setSerial(s);
    }
    
    return () => { mounted = false; };
  }, []);

  const totals = useMemo(() => {
    const lineTotals = lines.map(l => l.price * (l.quantity || 0));
    const total = lineTotals.reduce((a, b) => a + b, 0);
    const balance = total - (collection || 0);
    return { lineTotals, total, balance };
  }, [lines, collection]);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId) || null, [customers, customerId]);
  const currentDebt = useMemo(() => (selectedCustomer ? Number(selectedCustomer.totalDebt) : 0), [selectedCustomer]);
  const projectedDebt = useMemo(() => currentDebt + totals.balance, [currentDebt, totals.balance]);

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function onProductChange(idx: number, productId: string) {
    const p = products.find(pp => pp.id === productId);
    if (!p) {
      updateLine(idx, { productId, capacity: "", price: 0 });
    } else {
      // تحويل السعر إلى رقم مع التحقق من صحته
      const price = Number(p.price);
      updateLine(idx, { 
        productId, 
        capacity: p.capacity || '', 
        price: isNaN(price) ? 0 : price 
      });
    }
  }

  function addLine() {
    setLines(prev => [...prev, { productId: "", capacity: "", price: 0, quantity: 1 }]);
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  async function submitInvoice() {
    // Basic validation
    if (!customerId) {
      setError("Please select a customer");
      return;
    }
    // Build items list and allow collection-only invoices
    const validItems = lines
      .map(l => ({ ...l, quantity: Math.max(0, Math.floor(Number(l.quantity) || 0)) }))
      .filter(l => l.productId && l.quantity > 0)
      .map(l => ({ productId: l.productId, quantity: l.quantity }));

    setError(null);
    setSubmitStatus("Saving invoice...");

    try {
      // Ensure serial value
      let effectiveSerial = (serial || "").trim();
      if (!effectiveSerial) {
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        effectiveSerial = `INV-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        setSerial(effectiveSerial);
      }

      const payload = {
        serial: effectiveSerial,
        date,
        customerId,
        collection: Number(collection) || 0,
        items: validItems,
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}

      if (!res.ok) {
        const details = data?.details ? `: ${JSON.stringify(data.details?.fieldErrors || data.details)}` : "";
        throw new Error((data?.error || `HTTP ${res.status}`) + details);
      }

      setSubmitStatus("Invoice saved successfully!");

      // Reset form
      setSerial("");
      setDate(new Date().toISOString().slice(0, 10));
      setCustomerId("");
      setCollection(0);
      setLines([{ productId: "", capacity: "", price: 0, quantity: 1 }]);

    } catch (e: any) {
      setError(e.message || "Failed to save invoice");
      setSubmitStatus(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
        <span className="ml-2">Loading products and customers...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
        <p className="font-medium">Error loading data</p>
        <p className="text-sm mt-1">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 px-3 py-1 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 rounded text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Serial</label>
          <input 
            value={serial} 
            onChange={e => setSerial(e.target.value)} 
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)} 
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Collection (EGP)</label>
          <input 
            type="number" 
            min={0} 
            value={collection} 
            onChange={e => setCollection(Number(e.target.value))} 
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" 
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Customer</label>
        <div className="flex gap-2">
          <select 
            value={customerId} 
            onChange={e => setCustomerId(e.target.value)} 
            className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
          >
            <option value="">{customers.length ? 'Select a customer…' : 'No customers found — please add one'}</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ""}
              </option>
            ))}
          </select>
          <button 
            type="button" 
            onClick={() => setAddingCustomer(true)}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm"
          >
            + New
          </button>
        </div>
        
        {selectedCustomer && (
          <div className="mt-2 text-sm text-muted-foreground">
            Current Balance: {currentDebt.toLocaleString(undefined, { style: "currency", currency: "EGP" })} • 
            Projected Balance: {projectedDebt.toLocaleString(undefined, { style: "currency", currency: "EGP" })}
          </div>
        )}
      </div>

      {addingCustomer && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-medium mb-3">Add New Customer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Name *</label>
              <input 
                type="text" 
                value={newCustomer.name}
                onChange={e => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                placeholder="Customer name"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Phone</label>
              <input 
                type="tel" 
                value={newCustomer.phone}
                onChange={e => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                placeholder="Phone number"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input 
                type="email" 
                value={newCustomer.email}
                onChange={e => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                placeholder="Email address"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button 
              type="button" 
              onClick={() => setAddingCustomer(false)}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={async () => {
                if (!newCustomer.name.trim()) {
                  setError("Customer name is required");
                  return;
                }
                
                try {
                  const res = await fetch("/api/customers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: newCustomer.name,
                      phone: newCustomer.phone || undefined,
                      email: newCustomer.email || undefined
                    })
                  });
                  
                  const data = await res.json();
                  
                  if (!res.ok) {
                    throw new Error(data?.error || "Failed to add customer");
                  }
                  
                  setCustomers(prev => [...prev, data.customer]);
                  setCustomerId(data.customer.id);
                  setAddingCustomer(false);
                  setNewCustomer({ name: "", email: "", phone: "" });
                  
                } catch (e: any) {
                  setError(e.message || "Failed to add customer");
                }
              }}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Save Customer
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Products</h3>
          <button 
            type="button" 
            onClick={addLine}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            + Add Product
          </button>
        </div>
        
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-5">
                <select
                  value={line.productId}
                  onChange={e => onProductChange(idx, e.target.value)}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">Select a product…</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.capacity ? `(${p.capacity})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="col-span-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.price}
                  onChange={e => updateLine(idx, { price: Number(e.target.value) })}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                  placeholder="Price"
                />
              </div>
              
              <div className="col-span-2">
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                  placeholder="Qty"
                />
              </div>
              
              <div className="col-span-2 text-right font-medium">
                {(line.price * line.quantity).toLocaleString(undefined, { style: "currency", currency: "EGP" })}
              </div>
              
              <div className="col-span-1 text-right">
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  title="Remove line"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-end space-y-2 pt-4 border-t border-black/10 dark:border-white/10">
        <div className="flex justify-between w-full max-w-xs">
          <span className="text-muted-foreground">Subtotal:</span>
          <span className="font-medium">
            {totals.total.toLocaleString(undefined, { style: "currency", currency: "EGP" })}
          </span>
        </div>
        
        <div className="flex justify-between w-full max-w-xs">
          <span className="text-muted-foreground">Collection:</span>
          <span className="font-medium">
            {collection.toLocaleString(undefined, { style: "currency", currency: "EGP" })}
          </span>
        </div>
        
        <div className="flex justify-between w-full max-w-xs pt-2 mt-2 border-t border-black/10 dark:border-white/10">
          <span className="font-medium">Balance:</span>
          <span className={`font-bold ${totals.balance < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
            {totals.balance.toLocaleString(undefined, { style: "currency", currency: "EGP" })}
          </span>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={submitInvoice}
          disabled={!customerId || loading}
          className={`px-6 py-2 rounded-lg text-white font-medium ${
            !customerId || loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Saving...' : 'Save Invoice'}
        </button>
      </div>
      
      {submitStatus && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
          {submitStatus}
        </div>
      )}
      
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
