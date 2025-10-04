"use client";

import { useState } from "react";

export default function AdminNewUserForm() {
  const [form, setForm] = useState({ username: "", phone: "", email: "", name: "", password: "", role: "REQUESTER" as "REQUESTER"|"EMPLOYEE"|"MANAGER"|"ADMIN" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      setMessage("User created successfully");
      setForm({ username: "", phone: "", email: "", name: "", password: "", role: "REQUESTER" });
    } catch (e: any) {
      setError(e?.message || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 mb-8">
      <h2 className="text-lg font-semibold mb-2">Create New User</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div>
          <label className="block text-xs mb-1" htmlFor="nu-name">Name</label>
          <input id="nu-name" className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" value={form.name} onChange={(e)=>setForm(f=>({...f, name: e.target.value}))} maxLength={100} />
        </div>
        <div>
          <label className="block text-xs mb-1" htmlFor="nu-username">Username</label>
          <input id="nu-username" className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" value={form.username} onChange={(e)=>setForm(f=>({...f, username: e.target.value}))} minLength={3} maxLength={50} required />
        </div>
        <div>
          <label className="block text-xs mb-1" htmlFor="nu-phone">Phone</label>
          <input id="nu-phone" className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" value={form.phone} onChange={(e)=>setForm(f=>({...f, phone: e.target.value}))} minLength={5} maxLength={30} required />
        </div>
        <div>
          <label className="block text-xs mb-1" htmlFor="nu-email">Email</label>
          <input id="nu-email" type="email" className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" value={form.email} onChange={(e)=>setForm(f=>({...f, email: e.target.value}))} required />
        </div>
        <div>
          <label className="block text-xs mb-1" htmlFor="nu-password">Password</label>
          <input id="nu-password" type="password" className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" value={form.password} onChange={(e)=>setForm(f=>({...f, password: e.target.value}))} minLength={4} placeholder="Optional" />
        </div>
        <div>
          <label className="block text-xs mb-1" htmlFor="nu-role">Role</label>
          <select id="nu-role" className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" value={form.role} onChange={(e)=>setForm(f=>({...f, role: e.target.value as any}))}>
            <option value="REQUESTER">REQUESTER</option>
            <option value="EMPLOYEE">EMPLOYEE</option>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <div>
          <button disabled={submitting} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 text-sm disabled:opacity-60">{submitting ? "Creating…" : "Create"}</button>
        </div>
      </form>
      {(message || error) && (
        <div className={`mt-3 text-sm ${error ? "text-red-600" : "text-green-600"}`}>{error ?? message}</div>
      )}
    </div>
  );
}
