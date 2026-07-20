"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import {
  FEATURE_KEYS,
  FEATURE_SITES,
  defaultFeatureFlags,
} from "@/lib/feature-flags";
import type { FeatureFlags, FeatureKey, FeatureSite } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function FeatureFlagsManager() {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFeatureFlags);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [site, setSite] = useState<FeatureSite>("main");

  useEffect(() => {
    let alive = true;
    fetch("/api/feature-flags")
      .then(async (res) => {
        if (!res.ok) throw new Error("load failed");
        return res.json();
      })
      .then((data: { flags?: FeatureFlags }) => {
        if (alive && data.flags) setFlags(data.flags);
      })
      .catch(() => {
        if (alive) setError("Could not load feature flags");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback((key: FeatureKey) => {
    setSaved(false);
    setFlags((prev) => ({
      ...prev,
      [site]: {
        ...prev[site],
        [key]: !prev[site][key],
      },
    }));
  }, [site]);

  const onSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flags),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        flags?: FeatureFlags;
      };
      if (!res.ok || !data.flags) {
        setError(data.error || "Could not save");
        return;
      }
      setFlags(data.flags);
      setSaved(true);
    } catch {
      setError("Could not save feature flags");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-10 rounded-2xl border border-gold/20 bg-[#141018] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Flag size={18} className="text-gold" />
        <h2 className="font-display text-2xl text-cream">Feature flags</h2>
      </div>
      <p className="mb-5 font-body text-sm text-muted">
        Turn features on or off for each invite surface. Changes apply after
        save — guests on that link will see or hide the feature.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {FEATURE_SITES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSite(item.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] transition",
              site === item.id
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-gold/20 text-muted hover:text-cream",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 font-body text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-3">
          {FEATURE_KEYS.map((feature) => {
            const on = flags[site][feature.id];
            return (
              <label
                key={feature.id}
                className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gold/15 bg-black/20 px-4 py-3"
              >
                <span>
                  <span className="block font-body text-sm text-cream">
                    {feature.label}
                  </span>
                  <span className="mt-0.5 block font-body text-xs text-muted">
                    {feature.hint}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => toggle(feature.id)}
                  className={cn(
                    "relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition",
                    on
                      ? "border-emerald-400/40 bg-emerald-400/30"
                      : "border-white/15 bg-white/10",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-cream transition",
                      on ? "left-6" : "left-0.5",
                    )}
                  />
                </button>
              </label>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={saving || loading} onClick={onSave}>
          {saving ? "Saving…" : "Save flags"}
        </Button>
        {saved ? (
          <p className="font-body text-xs text-emerald-200">Saved</p>
        ) : null}
        {error ? <p className="font-body text-xs text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}
