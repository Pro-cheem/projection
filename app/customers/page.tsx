"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalDebt: number | string;
};

export default function CustomersPage() {
  const { data: session } = useSession();
  // @ts-expect-error custom role on session
  const role: string | undefined = session?.user?.role;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [creatingUserId, setCreatingUserId] = useState<string | null>(null);
  const [userCreatedInfo, setUserCreatedInfo] = useState<{customerId:string; email:string; password:string} | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState<string>("");

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

  async function saveCustomerEmail(customerId: string) {
    if (!editingEmailValue.trim()) return;
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, email: editingEmailValue.trim() }),
      });
      const data = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      // Update local state
      setCustomers(cs => cs.map(c => c.id === customerId ? { ...c, email: data.customer?.email || editingEmailValue.trim() } : c));
      setEditingEmailId(null);
      setEditingEmailValue("");
    } catch (e:any) {
      setError(e?.message || 'Failed to update email');
    }
  }
  }

  useEffect(() => { load(); }, []);

  async function createUserForCustomer(customerId: string) {
    setCreatingUserId(customerId);
    setError(null);
    setUserCreatedInfo(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const data = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data?.user && data?.password) {
        setUserCreatedInfo({ customerId, email: String(data.user.email || ''), password: String(data.password) });
      }
    } catch (e:any) {
      setError(e?.message || 'Failed to create user');
    } finally {
      setCreatingUserId(null);
    }
  }

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
          <div className="col-span-3">Name</div>
          <div className="col-span-4">Contact</div>
          <div className="col-span-3 text-right">Total Debt</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : customers.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No customers</div>
        ) : (
          customers.map(c => (
            <div key={c.id} className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-black/5 dark:border-white/5 items-center">
              <div className="col-span-3 text-sm">
                <a href={`/customers/${c.id}`} className="underline hover:no-underline">{c.name}</a>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {editingEmailId===c.id && (role === 'ADMIN' || role === 'MANAGER') ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editingEmailValue}
                        onChange={e=>setEditingEmailValue(e.target.value)}
                        className="rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-0.5 text-xs"
                        placeholder="user@projection.com"
                      />
                      <button onClick={()=>saveCustomerEmail(c.id)} className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 text-xs">Save</button>
                      <button onClick={()=>{setEditingEmailId(null); setEditingEmailValue("");}} className="rounded border border-black/10 dark:border-white/10 px-2 py-0.5 text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>user:</span>
                      <span className="font-mono">{c.email || '-'}</span>
                      {(role === 'ADMIN' || role === 'MANAGER') && (
                        <button onClick={()=>{setEditingEmailId(c.id); setEditingEmailValue(String(c.email||''));}} className="text-xs underline">Edit</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-4 text-sm">{c.phone ? `${c.phone}` : ""}</div>
              <div className="col-span-3 text-right text-sm">{Number(c.totalDebt).toLocaleString(undefined,{style:"currency",currency:"EGP"})}</div>
              <div className="col-span-2 text-right">
                <button onClick={()=>createUserForCustomer(c.id)} disabled={creatingUserId===c.id} className="rounded border border-black/10 dark:border-white/10 px-2 py-1 text-xs">
                  {creatingUserId===c.id? 'Creating…' : 'Create User'}
                </button>
                {userCreatedInfo && userCreatedInfo.customerId===c.id && (
                  <div className="mt-1 text-xs text-right">
                    <div className="text-emerald-700 dark:text-emerald-300">User created</div>
                    <div className="font-mono">Email: {userCreatedInfo.email}</div>
                    <div className="font-mono">Password: {userCreatedInfo.password}</div>
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
