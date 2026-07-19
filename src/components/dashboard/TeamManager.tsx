"use client";

import { useEffect, useState } from "react";
import { Shield, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PERMISSION_LABELS } from "@/lib/roles";
import type { AdminMember, AdminPermission } from "@/lib/types";
import { cn } from "@/lib/utils";

type SafeAdmin = Omit<AdminMember, "pinHash">;

const ASSIGNABLE: AdminPermission[] = [
  "rsvp",
  "stay",
  "gallery",
  "events",
  "guests",
];

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none focus:border-gold/60";

export function TeamManager() {
  const [admins, setAdmins] = useState<SafeAdmin[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [permissions, setPermissions] = useState<AdminPermission[]>(["gallery"]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/admins");
    if (!res.ok) return;
    const data = (await res.json()) as { admins?: SafeAdmin[] };
    setAdmins(data.admins || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const togglePerm = (perm: AdminPermission) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email.trim(),
          pin,
          permissions,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        emailSent?: boolean;
        emailError?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not create member");
        return;
      }
      if (data.emailSent) {
        setNotice(`Member created — access details emailed to ${email.trim()}`);
      } else {
        setError(
          data.emailError
            ? `Member created, but email failed: ${data.emailError}`
            : "Member created, but the invite email could not be sent.",
        );
      }
      setName("");
      setEmail("");
      setPin("");
      setPermissions(["gallery"]);
      await load();
    } catch {
      setError("Could not create member");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    const res = await fetch(`/api/admins/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  const onToggleActive = async (admin: SafeAdmin) => {
    await fetch(`/api/admins/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !admin.active }),
    });
    await load();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <form
        onSubmit={onCreate}
        className="rounded-2xl border border-gold/20 bg-[#141018] p-5"
      >
        <div className="mb-2 flex items-center gap-2">
          <UserPlus size={18} className="text-gold" />
          <h2 className="font-display text-2xl text-cream">Add team member</h2>
        </div>
        <p className="mb-5 font-body text-sm text-muted">
          Email is required — they’ll get the dashboard link, PIN, and access
          list. Master keeps full access.
        </p>

        <label className="mb-3 block">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Name
          </span>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="mb-3 block">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Email
          </span>
          <input
            type="email"
            className={fieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@email.com"
            required
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Their PIN
          </span>
          <input
            type="password"
            className={fieldClass}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            minLength={4}
            required
          />
        </label>

        <p className="mb-2 font-body text-[10px] uppercase tracking-[0.2em] text-muted">
          Permissions
        </p>
        <div className="space-y-2">
          {ASSIGNABLE.map((perm) => (
            <label
              key={perm}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-gold/15 px-3 py-2.5"
            >
              <input
                type="checkbox"
                checked={permissions.includes(perm)}
                onChange={() => togglePerm(perm)}
                className="accent-[#c9a24d]"
              />
              <span className="font-body text-sm text-cream">
                {PERMISSION_LABELS[perm]}
              </span>
            </label>
          ))}
        </div>

        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        {notice ? <p className="mt-3 text-xs text-gold-soft">{notice}</p> : null}

        <Button type="submit" disabled={busy} className="mt-5 w-full">
          {busy ? "Saving & emailing…" : "Create & email access"}
        </Button>
      </form>

      <div>
        <div className="mb-4 flex items-center gap-2">
          <Shield size={18} className="text-gold" />
          <h3 className="font-display text-2xl text-cream">Team</h3>
        </div>
        {admins.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
            No team members yet. Add someone with a limited role.
          </p>
        ) : (
          <div className="space-y-3">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className={cn(
                  "rounded-2xl border border-gold/20 bg-[#141018] p-4",
                  !admin.active && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl text-cream">
                      {admin.name}
                    </p>
                    {admin.email ? (
                      <p className="font-body text-xs text-muted">
                        {admin.email}
                      </p>
                    ) : null}
                    <p className="mt-2 font-body text-[11px] text-gold-soft">
                      {admin.permissions
                        .map((p) => PERMISSION_LABELS[p] || p)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void onToggleActive(admin)}
                      className="rounded-full border border-gold/25 px-3 py-1.5 font-body text-[10px] uppercase tracking-wider text-gold-soft"
                    >
                      {admin.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(admin.id)}
                      className="rounded-full border border-red-400/30 p-2 text-red-200"
                      aria-label={`Remove ${admin.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
