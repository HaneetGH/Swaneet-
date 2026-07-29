"use client";

import { Check, Heart, Mail, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GuestMessage } from "@/lib/types";
import { isSampleWish } from "@/data/sample-wishes";
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
  const [manualEmail, setManualEmail] = useState("");

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

  const pendingCount = messages.filter(
    (item) => item.status === "pending" && !isSampleWish(item),
  ).length;
  const approvedCount = messages.filter(
    (item) => item.status === "approved" && !isSampleWish(item),
  ).length;
  const sampleCount = messages.filter((item) => isSampleWish(item)).length;
  const missingEmailCount = messages.filter(
    (item) => !isSampleWish(item) && !item.authEmail?.trim(),
  ).length;

  const selectedGuestWishes = useMemo(
    () =>
      messages.filter(
        (item) => selectedIds.includes(item.id) && !isSampleWish(item),
      ),
    [messages, selectedIds],
  );

  const selectedWithEmail = selectedGuestWishes.filter((item) =>
    Boolean(item.authEmail?.trim()),
  );
  const selectedMissingEmail = selectedGuestWishes.filter(
    (item) => !item.authEmail?.trim(),
  );
  const singleMissing =
    selectedGuestWishes.length === 1 && selectedMissingEmail.length === 1
      ? selectedMissingEmail[0]
      : null;

  useEffect(() => {
    setManualEmail("");
  }, [singleMissing?.id]);

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
          ? "Approved — guests emailed that their wish is live."
          : action === "reject"
            ? "Rejected — guests sent a gentle note."
            : "Deleted.",
      );
      await load();
    } catch {
      setError("Could not update wishes");
    } finally {
      setBusy(false);
    }
  };

  const notify = async (options?: { email?: string; ids?: string[] }) => {
    const ids = options?.ids || selectedGuestWishes.map((item) => item.id);
    if (ids.length === 0) return;

    const label = options?.email
      ? `Save ${options.email} and send status email?`
      : `Resend status email for ${ids.length} wish(es)? (pending → received, approved → live, rejected → note)`;
    if (!confirm(label)) return;

    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/messages/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          action: "notify",
          email: options?.email,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sent?: number;
        skipped?: number;
        failed?: number;
        ignored?: number;
        kinds?: string[];
        errors?: string[];
      };
      if (!res.ok) {
        setError(data.error || "Could not send emails");
        return;
      }
      setSelectedIds([]);
      setManualEmail("");
      const kindSummary = data.kinds?.length
        ? ` (${[...new Set(data.kinds)].join(", ")})`
        : "";
      const parts = [
        `${data.sent || 0} emailed${kindSummary}`,
        data.skipped ? `${data.skipped} skipped (no email)` : "",
        data.failed ? `${data.failed} failed` : "",
        data.ignored ? `${data.ignored} ignored` : "",
      ].filter(Boolean);
      setNote(parts.join(" · "));
      if (data.errors?.length) setError(data.errors.join(" · "));
      await load();
    } catch {
      setError("Could not send emails");
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
            Guests auto-get email on submit (in review), approve (live), and
            reject. Resend anytime — or add an email when one is missing.
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
        {sampleCount > 0 ? (
          <span className="self-center font-body text-[11px] text-muted">
            {sampleCount} seeded sample{sampleCount === 1 ? "" : "s"} in DB
          </span>
        ) : null}
        {missingEmailCount > 0 ? (
          <span className="self-center font-body text-[11px] text-amber-100/90">
            {missingEmailCount} missing email
          </span>
        ) : null}
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
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
            {selectedWithEmail.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void notify({
                    ids: selectedWithEmail.map((item) => item.id),
                  })
                }
                className="!px-4 !py-2 !text-[11px]"
              >
                <Mail size={14} />
                Resend email ({selectedWithEmail.length})
              </Button>
            ) : null}
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

          {singleMissing ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
              <p className="font-body text-sm text-amber-50">
                <span className="font-medium">{singleMissing.displayName}</span>{" "}
                has no email — add one to send their status note.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(event) => setManualEmail(event.target.value)}
                  placeholder="guest@email.com"
                  className="min-w-[16rem] flex-1 rounded-full border border-gold/25 bg-[#141018] px-4 py-2 font-body text-sm text-cream outline-none placeholder:text-muted/70 focus:border-gold/50"
                />
                <Button
                  type="button"
                  disabled={busy || !manualEmail.trim()}
                  onClick={() =>
                    void notify({
                      ids: [singleMissing.id],
                      email: manualEmail.trim(),
                    })
                  }
                  className="!px-4 !py-2 !text-[11px]"
                >
                  <Mail size={14} />
                  Save email &amp; send
                </Button>
              </div>
            </div>
          ) : selectedMissingEmail.length > 1 ? (
            <p className="font-body text-xs text-amber-100/90">
              {selectedMissingEmail.length} selected wishes have no email —
              select one at a time to add an address and send.
            </p>
          ) : null}
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
            const missingEmail = !isSampleWish(item) && !item.authEmail?.trim();
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
                    {isSampleWish(item) ? (
                      <span className="rounded-full border border-gold/30 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-gold/80">
                        sample · DB
                      </span>
                    ) : null}
                    {missingEmail ? (
                      <span className="rounded-full border border-amber-400/35 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-amber-100">
                        no email
                      </span>
                    ) : null}
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
