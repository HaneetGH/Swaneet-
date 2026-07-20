"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type StorageInfo = {
  mode: "database" | "blob" | "local" | "none";
  canPersist: boolean;
  isVercel: boolean;
};

export function StorageBanner() {
  const [info, setInfo] = useState<StorageInfo | null>(null);

  useEffect(() => {
    fetch("/api/storage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StorageInfo | null) => setInfo(data))
      .catch(() => undefined);
  }, []);

  if (!info || info.canPersist) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-100">
      <AlertTriangle className="mt-0.5 shrink-0" size={18} />
      <div className="font-body text-sm leading-relaxed">
        <p className="font-medium text-amber-50">Storage not connected</p>
        <p className="mt-1 text-amber-100/80">
          Wedding content must live in <strong>Neon Postgres</strong>. Connect
          it in the Vercel project Storage tab, then redeploy. Do not rely on{" "}
          <code className="text-amber-50">data/content.json</code>.
        </p>
      </div>
    </div>
  );
}
