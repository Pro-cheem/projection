"use client";

import { useState } from "react";
import { User, Phone, MessageSquare } from "lucide-react";

export default function FeedbackPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name || undefined, phone: phone || undefined, message }) });
      const txt = await res.text();
      let data: any = null; try { data = txt ? JSON.parse(txt) : null; } catch {}
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setDone(true);
      setName(""); setPhone(""); setMessage("");
    } catch (e: any) {
      setError(e?.message || "تعذر الإرسال. حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  }

  const valid = name.trim().length >= 2 && phone.trim().length >= 5 && message.trim().length >= 5;

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-right">ملاحظات/شكاوى</h1>
        <a href="/" className="text-sm underline">عودة للرئيسية</a>
      </div>
      {done ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 p-4 text-sm text-right">
          تم استلام رسالتك، وشكرًا لتواصلك.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 text-right">
          <div>
            <label className="block text-sm mb-1 text-zinc-800 dark:text-zinc-200">الاسم</label>
            <div className="relative">
              <input 
                type="text"
                value={name}
                onChange={(e)=>setName(e.target.value)} 
                required 
                minLength={2}
                placeholder="اكتب اسمك"
                autoComplete="name"
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent pr-9 pl-3 py-2 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" 
              />
              <User size={18} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-800 dark:text-zinc-200">الهاتف</label>
            <div className="relative">
              <input 
                type="tel"
                inputMode="tel"
                value={phone} 
                onChange={(e)=>setPhone(e.target.value)} 
                required 
                minLength={5}
                placeholder="أدخل رقم هاتفك"
                autoComplete="tel"
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent pr-9 pl-3 py-2 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" 
              />
              <Phone size={18} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-800 dark:text-zinc-200">الرسالة</label>
            <div className="relative">
              <textarea 
                value={message} 
                onChange={(e)=>setMessage(e.target.value)} 
                required 
                minLength={5} 
                maxLength={5000} 
                placeholder="اكتب ملاحظتك أو الشكوى بالتفصيل..." 
                className="w-full min-h-40 rounded-lg border border-black/10 dark:border-white/10 bg-transparent pr-9 pl-3 py-2 placeholder:text-zinc-400 dark:placeholder:text-zinc-500" 
              />
              <MessageSquare size={18} className="absolute right-2 top-3 text-zinc-400 dark:text-zinc-500" />
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="text-left">
            <button type="submit" disabled={submitting || !valid} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 text-sm">
              {submitting ? "جارٍ الإرسال…" : "إرسال"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
