"use client";

import { useEffect, useMemo, useState } from "react";

function formatName(u: { name: string | null; username: string | null }) {
  return u.name || u.username || "—";
}

function formatVal(v: string | null | undefined) {
  return v || "—";
}

// Simple CSV exporter for reps aggregates
function exportRepsCsv(
  employees: { id: string; name: string | null; username?: string | null; email: string | null; phone: string | null }[],
  repAggs: Record<string, {
    invoiceCount: number;
    salesTotal: number | string;
    collectionsTotal: number | string;
    balancesTotal: number | string;
    customerCount: number;
    customerDebtTotal: number | string;
  }>
) {
  try {
    const headers = [
      "ID",
      "Name",
      "Email",
      "Phone",
      "Invoices",
      "Sales",
      "Collections",
      "Balances",
      "Customers",
      "Debt",
    ];
    const rows = employees.map((u) => {
      const a = repAggs[u.id] || {
        invoiceCount: 0,
        salesTotal: 0,
        collectionsTotal: 0,
        balancesTotal: 0,
        customerCount: 0,
        customerDebtTotal: 0,
      };
      return [
        u.id,
        (u.name || "").replaceAll(",", " "),
        u.email || "",
        u.phone || "",
        String(a.invoiceCount ?? 0),
        String(Number(a.salesTotal || 0)),
        String(Number(a.collectionsTotal || 0)),
        String(Number(a.balancesTotal || 0)),
        String(a.customerCount ?? 0),
        String(Number(a.customerDebtTotal || 0)),
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => {
        // Escape values containing commas, quotes, or newlines
        const s = String(v ?? "");
        if (/[",\n]/.test(s)) {
          return '"' + s.replaceAll('"', '""') + '"';
        }
        return s;
      }).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `reps-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    // best-effort; surface minimal info in console
    console.error("Failed to export CSV", e);
  }
}

export default function AdminUsersTable({
  requesters,
  employees,
  managers,
}: {
  requesters: { id: string; name: string | null; username: string | null; email: string | null; phone: string | null }[];
  employees: { id: string; name: string | null; username: string | null; email: string | null; phone: string | null }[];
  managers: { id: string; name: string | null; username: string | null; email: string | null; phone: string | null }[];
}) {
  // Load representatives aggregates once for the employees table
  const [repAggs, setRepAggs] = useState<Record<string, {
    invoiceCount: number;
    salesTotal: number | string;
    collectionsTotal: number | string;
    balancesTotal: number | string;
    customerCount: number;
    customerDebtTotal: number | string;
  }>>({});
  const [aggError, setAggError] = useState<string | null>(null);
  const [aggLoading, setAggLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const egpFmt = useMemo(() => new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP" }), []);

  async function loadAggs() {
    setAggLoading(true);
    setAggError(null);
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (from) qs.set("from", from);
        if (to) qs.set("to", to);
        const res = await fetch(`/api/reps?${qs.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        const map: Record<string, any> = {};
        for (const r of json.reps || []) {
          map[r.id] = {
            invoiceCount: r.invoiceCount || 0,
            salesTotal: r.salesTotal || 0,
            collectionsTotal: r.collectionsTotal || 0,
            balancesTotal: r.balancesTotal || 0,
            customerCount: r.customerCount || 0,
            customerDebtTotal: r.customerDebtTotal || 0,
          };
        }
        setRepAggs(map);
      } catch (e: any) {
        setAggError(e?.message || "Failed to load reps aggregates");
      } finally {
        setAggLoading(false);
      }
    })();
  }

  useEffect(() => { loadAggs(); /* eslint-disable-line */ }, []);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xl font-semibold mb-3">Pending Customers</h2>
        {requesters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending customers.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/10">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Username</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Phone</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {requesters.map((u) => (
                  <Row key={u.id} user={u} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Representatives</h2>
        <div className="flex items-center gap-2 mb-3">
          <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm" />
          <span>إلى</span>
          <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="rounded border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm" />
          <button onClick={loadAggs} className="rounded bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm">تطبيق</button>
          <button onClick={()=>exportRepsCsv(employees, repAggs)} disabled={aggLoading} className="rounded border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm">تصدير CSV</button>
        </div>
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No representatives yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/10">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Username</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Phone</th>
                  <th className="text-right p-3">Invoices</th>
                  <th className="text-right p-3">Sales</th>
                  <th className="text-right p-3">Collections</th>
                  <th className="text-right p-3">Balances</th>
                  <th className="text-right p-3">Customers</th>
                  <th className="text-right p-3">Debt</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((u) => (
                  <EmployeeRow key={u.id} user={u} repAgg={repAggs[u.id]} loadingAgg={aggLoading} egpFmt={egpFmt} />
                ))}
              </tbody>
            </table>
            {aggError && <div className="p-3 text-xs text-red-600">{aggError}</div>}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Managers</h2>
        {managers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No managers.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/10">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Username</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Phone</th>
                  <th className="text-right p-3">Open</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((u) => (
                  <tr key={u.id} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-3">{formatName(u as any)}</td>
                    <td className="p-3">{formatVal((u as any).username)}</td>
                    <td className="p-3">{formatVal((u as any).email)}</td>
                    <td className="p-3">{formatVal((u as any).phone)}</td>
                    <td className="p-3 text-right"><a href={`/reps/${u.id}`} className="underline text-blue-600 text-xs">Open</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ user }: { user: { id: string; name: string | null; username: string | null; email: string | null; phone: string | null } }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: "EMPLOYEE" }),
      });
      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      setDone(true);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) return null;

  return (
    <tr className="border-t border-black/10 dark:border-white/10">
      <td className="p-3">{formatName(user)}</td>
      <td className="p-3">{formatVal(user.username)}</td>
      <td className="p-3">{formatVal(user.email)}</td>
      <td className="p-3">{formatVal(user.phone)}</td>
      <td className="p-3 text-right">
        <button onClick={approve} disabled={loading} className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs disabled:opacity-60">
          {loading ? "Approving…" : "Approve as Representative"}
        </button>
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </td>
    </tr>
  );
}

function EmployeeRow({ user, repAgg, loadingAgg, egpFmt }: { user: { id: string; name: string | null; username: string | null; email: string | null; phone: string | null }, repAgg?: { invoiceCount: number; salesTotal: number | string; collectionsTotal: number | string; balancesTotal: number | string; customerCount: number; customerDebtTotal: number | string }, loadingAgg: boolean, egpFmt: Intl.NumberFormat }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revertToCustomer() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: "REQUESTER" }),
      });
      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
      setDone(true);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) return null;

  return (
    <tr className="border-t border-black/10 dark:border-white/10">
      <td className="p-3">{formatName(user)}</td>
      <td className="p-3">{formatVal(user.username)}</td>
      <td className="p-3">{formatVal(user.email)}</td>
      <td className="p-3">{formatVal(user.phone)}</td>
      <td className="p-3 text-right">{loadingAgg ? "…" : (repAgg?.invoiceCount ?? 0)}</td>
      <td className="p-3 text-right">{loadingAgg ? "…" : egpFmt.format(Number(repAgg?.salesTotal || 0))}</td>
      <td className="p-3 text-right">{loadingAgg ? "…" : egpFmt.format(Number(repAgg?.collectionsTotal || 0))}</td>
      <td className="p-3 text-right">{loadingAgg ? "…" : egpFmt.format(Number(repAgg?.balancesTotal || 0))}</td>
      <td className="p-3 text-right">{loadingAgg ? "…" : (repAgg?.customerCount ?? 0)}</td>
      <td className="p-3 text-right">{loadingAgg ? "…" : egpFmt.format(Number(repAgg?.customerDebtTotal || 0))}</td>
      <td className="p-3 text-right">
        <button onClick={revertToCustomer} disabled={loading} className="rounded-md bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-xs disabled:opacity-60">
          {loading ? "Updating…" : "Revert to Customer"}
        </button>
        <a href={`/reps/${user.id}`} className="ml-2 underline text-blue-600 text-xs">Open</a>
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </td>
    </tr>
  );
}
