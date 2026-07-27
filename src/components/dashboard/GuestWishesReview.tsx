"use client";

import { Check, Heart, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GuestMessage } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function GuestWishesReview() {
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">(
    "pending",
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/messages/moderate", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        messages?: GuestMessage[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not load wishes");
        return;
      }
      setMessages(data.messages || []);
    } catch {
      setError("Could not load wishes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return messages;
    return messages.filter((item) => item.status === filter);
  }, [filter, messages]);

  const pendingCount = messages.filter((item) => item.status === "pending")
    .length;
  const approvedCount = messages.filter((item) => item.status === "approved")
    .length;

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const moderate = async (action: "approve" | "reject" | "delete") => {
    if (selectedIds.length === 0) return;
    if (
      action === "delete" &&
      !confirm(`Delete ${selectedIds.length} wish(es)?`)
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/messages/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not update wishes");
        return;
      }
      setSelectedIds([]);
      setNote(
        action === "approve"
          ? "Approved — now visible on the wishes wall."
          : action === "reject"
            ? "Rejected."
            : "Deleted.",
      );
      await load();
    } catch {
      setError("Could not update wishes");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-gold" />
            <h2 className="font-display text-2xl text-cream">Guest wishes</h2>
          </div>
          <p className="mt-1 font-body text-sm text-muted">
            Review messages and quotes before they appear on the public wishes
            wall.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-gold/25 px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] text-gold-soft hover:bg-gold/10"
        >
          Refresh
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["pending", `Pending (${pendingCount})`],
            ["approved", `Approved (${approvedCount})`],
            ["all", `All (${messages.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] transition",
              filter === id
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-gold/20 text-muted hover:text-cream",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void moderate("approve")}
            className="!px-4 !py-2 !text-[11px]"
          >
            <Check size={14} />
            Approve ({selectedIds.length})
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void moderate("reject")}
            className="!px-4 !py-2 !text-[11px]"
          >
            <X size={14} />
            Reject
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void moderate("delete")}
            className="!px-4 !py-2 !text-[11px]"
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
      {note ? <p className="mb-3 text-sm text-emerald-200">{note}</p> : null}

      {loading ? (
        <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
          Loading wishes…
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
          No wishes in this view.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-4 text-left transition",
                    selected
                      ? "border-gold/50 bg-gold/10"
                      : "border-gold/20 bg-[#141018] hover:border-gold/35",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em]",
                        item.status === "approved"
                          ? "border-emerald-400/35 text-emerald-200"
                          : item.status === "pending"
                            ? "border-amber-400/35 text-amber-100"
                            : "border-rose-400/35 text-rose-200",
                      )}
                    >
                      {item.status}
                    </span>
                    <span className="font-body text-sm text-cream">
                      {item.displayName}
                    </span>
                    {item.authEmail ? (
                      <span className="font-body text-xs text-muted">
                        {item.authEmail}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 font-display text-xl leading-relaxed text-cream">
                    “{item.body}”
                  </p>
                  <p className="mt-2 font-body text-[11px] text-muted">
                    {new Date(item.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {item.inviteSlug ? ` · ${item.inviteSlug}` : ""}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
