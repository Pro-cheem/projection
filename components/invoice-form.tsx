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
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<null | { id: string; serial: string; total: number; balance: number; collection: number }>(null);

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
          
          if (validProducts.length === 0) {
            setError('No products available. Please add products first.');
          }
          if (validCustomers.length === 0) {
            setError(prev => prev ? prev + ' No customers available. Please add customers first.' : 'No customers available. Please add customers first.');
          }
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

  async function createCustomer() {
    if (!newCustomer.name.trim()) return;
    setAddingCustomer(true);
    setError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomer),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setCustomers(prev => [...prev, data.customer]);
      setCustomerId(data.customer.id);
      setNewCustomer({ name: "", email: "", phone: "" });
    } catch (e: any) {
      setError(e.message || "Failed to create customer");
    } finally {
      setAddingCustomer(false);
    }
  }

  async function submitInvoice() {
    setSubmitStatus(null);
    setError(null);
    setSaving(true);
    try {
      let effectiveSerial = serial.trim();
      if (!effectiveSerial) {
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        effectiveSerial = `INV-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        setSerial(effectiveSerial);
      }
      if (!customerId) throw new Error("Customer is required");
      const validItems = lines
        .map(l => ({ ...l, quantity: Math.max(0, Math.floor(Number(l.quantity) || 0)) }))
        .filter(l => l.productId && l.quantity > 0)
        .map(l => ({ productId: l.productId, quantity: l.quantity }));

      // Allow collection-only invoices: it's OK if there are no items

      const payload = {
        serial: effectiveSerial,
        date,
        customerId,
        collection: Number(collection || 0),
        items: validItems,
      };
      console.log("Submitting invoice payload", payload);
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (!res.ok) {
        const details = data?.details ? `: ${JSON.stringify(data.details?.fieldErrors || data.details, null, 0)}` : "";
        throw new Error((data?.error || `HTTP ${res.status}`) + details);
      }

      setSubmitStatus("Invoice saved successfully.");
      setLastSaved({ id: String(data?.invoiceId || ""), serial: effectiveSerial, total: Number(data?.total || 0), balance: Number(data?.balance || 0), collection: Number(data?.collection || 0) });
      // Refresh customers to reflect updated totalDebt
      try {
        const cusRes = await fetch("/api/customers").then(r=>r.json()).catch(()=>null);
        if (cusRes && !cusRes.error && Array.isArray(cusRes.customers)) {
          setCustomers(cusRes.customers);
        }
      } catch {}
    } catch (e: any) {
      setError(e.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  }

  function printInvoice() {
    try {
      const customer = customers.find(c => c.id === customerId);
      const wnd = window.open("", "_blank");
      if (!wnd) return;
      const rows = lines
        .filter(l => l.productId && l.quantity > 0)
        .map(l => {
          const prod = products.find(p => p.id === l.productId);
          return `<tr><td>${prod?.name || ""}</td><td>${l.capacity || ""}</td><td style='text-align:right'>${l.price}</td><td style='text-align:right'>${l.quantity}</td><td style='text-align:right'>${(l.price * l.quantity).toFixed(2)}</td></tr>`;
        })
        .join("");
      const html = `<!doctype html><html><head><meta charset='utf-8'><title>Invoice ${serial}</title>
        <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,"Noto Sans","Helvetica Neue",Arial,"Apple Color Emoji","Segoe UI Emoji";padding:24px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:8px} th{text-align:left;background:#f7f7f7} h1{margin:0 0 8px 0} .muted{color:#666}</style>
      </head><body>
        <h1>Invoice</h1>
        <div class='muted'>Serial: ${serial}</div>
        <div class='muted'>Date: ${date}</div>
        <div class='muted'>Customer: ${customer?.name || "-"}</div>
        <div class='muted'>Customer Debt (current): ${currentDebt.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
        <div class='muted'>This Invoice Balance: ${totals.balance.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
        <div class='muted'>Projected Debt: ${(currentDebt + totals.balance).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
        <hr style='margin:16px 0' />
        <table>
          <thead><tr><th>Product</th><th>Capacity</th><th style='text-align:right'>Price</th><th style='text-align:right'>Qty</th><th style='text-align:right'>Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style='margin-top:12px; text-align:right'>
          <div>Total: <strong>${totals.total.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</strong></div>
          <div>Collection: <strong>${Number(collection||0).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</strong></div>
          <div>Balance: <strong>${totals.balance.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</strong></div>
        </div>
        <script>window.onload=()=>{window.print();}</script>
      </body></html>`;
      wnd.document.open();
      wnd.document.write(html);
      wnd.document.close();
    } catch {}
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
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2">
            <option value="">Select a customer…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
            ))}
          </select>
          <button type="button" onClick={createCustomer} disabled={addingCustomer || !newCustomer.name.trim()} className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm">Add</button>
        </div>
        {selectedCustomer && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
              <div className="text-emerald-700 dark:text-emerald-300">Current Debt</div>
              <div className="font-semibold">{currentDebt.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
            </div>
            <div className="rounded-lg border border-blue-600/30 bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
              <div className="text-blue-700 dark:text-blue-300">This Invoice Balance</div>
              <div className="font-semibold">{totals.balance.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
            </div>
            <div className="rounded-lg border border-amber-600/30 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
              <div className="text-amber-700 dark:text-amber-300">Projected Debt</div>
              <div className="font-semibold">{projectedDebt.toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <input placeholder="New customer name" value={newCustomer.name} onChange={e => setNewCustomer(v => ({ ...v, name: e.target.value }))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
          <input placeholder="Email (optional)" value={newCustomer.email} onChange={e => setNewCustomer(v => ({ ...v, email: e.target.value }))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
          <input placeholder="Phone (optional)" value={newCustomer.phone} onChange={e => setNewCustomer(v => ({ ...v, phone: e.target.value }))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
        </div>
      </div>

      <div>
        <div className="grid grid-cols-12 gap-2 font-medium text-sm mb-1">
          <div className="col-span-5">Product</div>
          <div className="col-span-2">Capacity</div>
          <div className="col-span-2">Price (EGP)</div>
          <div className="col-span-2">Qty</div>
          <div className="col-span-1 text-right">Total</div>
        </div>
        {lines.map((l, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center py-1">
            <div className="col-span-5">
              <select value={l.productId} onChange={e => onProductChange(idx, e.target.value)} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2">
                <option value="">Select product…</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 text-sm text-muted-foreground">{l.capacity || "—"}</div>
            <div className="col-span-2">
              <input type="number" min={0} value={l.price} onChange={e => updateLine(idx, { price: Number(e.target.value) })} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
            </div>
            <div className="col-span-2">
              <input type="number" min={1} step={1} value={l.quantity}
                onChange={e => updateLine(idx, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 0)) })}
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
            </div>
            <div className="col-span-1 text-right text-sm">{(l.price * (l.quantity || 0)).toLocaleString(undefined, { style: "currency", currency: "EGP" })}</div>
            <div className="col-span-12 text-right">
              {lines.length > 1 && (
                <button type="button" onClick={() => removeLine(idx)} className="text-xs text-red-600">Remove</button>
              )}
            </div>
          </div>
        ))}
        <div className="mt-2">
          <button type="button" onClick={addLine} className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm">Add Line</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-end items-end">
        <div className="text-sm text-muted-foreground">Invoice Total</div>
        <div className="text-xl font-semibold">{totals.total.toLocaleString(undefined, { style: "currency", currency: "EGP" })}</div>
        <div className="text-sm text-muted-foreground">Balance</div>
        <div className="text-xl font-semibold">{totals.balance.toLocaleString(undefined, { style: "currency", currency: "EGP" })}</div>
        {selectedCustomer && (
          <div className="text-sm text-muted-foreground ml-4">Customer Debt</div>
        )}
        {selectedCustomer && (
          <div className="text-xl font-semibold">{currentDebt.toLocaleString(undefined, { style: "currency", currency: "EGP" })}</div>
        )}
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <button type="button" onClick={submitInvoice} disabled={saving} className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2">{saving?"Saving invoice...":"Save Invoice"}</button>
        {submitStatus && <span className="text-sm text-emerald-600">{submitStatus}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
        {lastSaved && (
          <button type="button" onClick={printInvoice} className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm">Print Invoice</button>
        )}
        <a href="/journal" className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm">Open Journal</a>
        <a href="/stock" className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm">Open Stock</a>
      </div>
      {error && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary>Show debug</summary>
          <pre className="whitespace-pre-wrap break-words">{JSON.stringify({ serial, date, customerId, collection, lines }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
