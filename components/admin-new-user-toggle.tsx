"use client";

import { useState } from "react";
import AdminNewUserForm from "@/components/admin-new-user-form";

export default function AdminNewUserToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">إدارة المستخدمين</h2>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 text-sm"
          aria-expanded={open}
          aria-controls="new-user-form"
        >
          {open ? "إغلاق" : "إضافة مستخدم"}
        </button>
      </div>
      {open && (
        <div id="new-user-form" className="mt-4">
          <AdminNewUserForm onSuccess={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
