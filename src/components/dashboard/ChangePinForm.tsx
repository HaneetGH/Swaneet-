"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none [color-scheme:dark] focus:border-gold/60";

export function ChangePinForm() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await fetch("/api/auth/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin, confirmPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update PIN");
        return;
      }

      setSuccess("PIN updated successfully. Use the new PIN next time you log in.");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch {
      setError("Could not update PIN");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center gap-2">
        <KeyRound size={18} className="text-gold" />
        <div>
          <h2 className="font-display text-2xl text-cream">Change PIN</h2>
          <p className="mt-1 font-body text-sm text-muted">
            Update the dashboard login PIN. You’ll need the current PIN to confirm.
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-gold/20 bg-[#141018] p-5"
      >
        <label className="block">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Current PIN
          </span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            className={fieldClass}
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            required
            minLength={4}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            New PIN
          </span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            className={fieldClass}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            required
            minLength={4}
            maxLength={32}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Confirm new PIN
          </span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            className={fieldClass}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            required
            minLength={4}
            maxLength={32}
          />
        </label>

        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        {success ? <p className="text-xs text-emerald-300">{success}</p> : null}

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Updating…" : "Update PIN"}
        </Button>
      </form>
    </div>
  );
}
