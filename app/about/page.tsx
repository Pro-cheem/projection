"use client";

import { useEffect, useState } from "react";

export default function AboutPage() {
  const [title, setTitle] = useState<string>("عن الشركة");
  const [body, setBody] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/site-config", { cache: "no-store" });
        const j = await res.json();
        if (j?.config) {
          if (j.config.aboutTitle) setTitle(j.config.aboutTitle);
          if (j.config.aboutBody) setBody(j.config.aboutBody);
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-semibold mb-4 text-right">{title}</h1>
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : body ? (
        <div className="prose prose-zinc dark:prose-invert max-w-none text-right whitespace-pre-wrap leading-relaxed">{body}</div>
      ) : (
        <div className="text-muted-foreground text-right">لا توجد معلومات بعد.</div>
      )}
    </div>
  );
}
