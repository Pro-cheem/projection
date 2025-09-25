"use client";

import { useEffect, useState } from "react";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalDebt: number | string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setCustomers(data.customers || []);
    } catch (e: any) {
      setError(e.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email || undefined, phone: form.phone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setForm({ name: "", email: "", phone: "" });
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to create customer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <a href="/invoice" className="text-sm underline">Back to Invoice</a>
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 p-6 bg-white dark:bg-zinc-900 mb-8">
        <h2 className="font-medium mb-3">Add Customer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input placeholder="Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
          <input placeholder="Email (optional)" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
          <input placeholder="Phone (optional)" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
          <button onClick={onCreate} disabled={submitting || !form.name.trim()} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm">{submitting?"Saving…":"Save"}</button>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm font-medium border-b border-black/10 dark:border-white/10">
          <div className="col-span-4">Name</div>
          <div className="col-span-4">Contact</div>
          <div className="col-span-4 text-right">Total Debt</div>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : customers.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No customers</div>
        ) : (
          customers.map(c => (
            <div key={c.id} className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-black/5 dark:border-white/5">
              <div className="col-span-4 text-sm">{c.name}</div>
              <div className="col-span-4 text-sm">{c.email || "-"} {c.phone ? `• ${c.phone}` : ""}</div>
              <div className="col-span-4 text-right text-sm">{Number(c.totalDebt).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
