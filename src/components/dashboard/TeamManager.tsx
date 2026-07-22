"use client";

import { useEffect, useState } from "react";
import { Pencil, Shield, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PERMISSION_LABELS, memberUsername } from "@/lib/roles";
import type { AdminMember, AdminPermission } from "@/lib/types";
import { cn } from "@/lib/utils";

type SafeAdmin = Omit<AdminMember, "pinHash">;

const ASSIGNABLE: AdminPermission[] = [
  "rsvp",
  "stay",
  "gallery_upload",
  "gallery_review",
  "faces",
  "events",
  "guests",
];

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none focus:border-gold/60";

export function TeamManager() {
  const [admins, setAdmins] = useState<SafeAdmin[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [permissions, setPermissions] = useState<AdminPermission[]>([
    "gallery_upload",
  ]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const isEditing = Boolean(editingId);

  const load = async () => {
    const res = await fetch("/api/admins");
    if (!res.ok) return;
    const data = (await res.json()) as { admins?: SafeAdmin[] };
    setAdmins(data.admins || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setEmail("");
    setPin("");
    setPermissions(["gallery_upload"]);
    setError("");
  };

  const startEdit = (admin: SafeAdmin) => {
    setEditingId(admin.id);
    setName(admin.name);
    setEmail(admin.email || "");
    setPin("");
    setPermissions(
      admin.permissions.filter((p) => ASSIGNABLE.includes(p)),
    );
    setError("");
    setNotice("");
  };

  const togglePerm = (perm: AdminPermission) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.length) {
      setError("Pick at least one permission");
      return;
    }
    if (!isEditing && pin.trim().length < 4) {
      setError("PIN must be at least 4 characters");
      return;
    }
    if (isEditing && pin && pin.trim().length < 4) {
      setError("New PIN must be at least 4 characters");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isEditing && editingId) {
        const res = await fetch(`/api/admins/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email: email.trim(),
            permissions,
            ...(pin.trim() ? { pin: pin.trim() } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          emailSent?: boolean;
          emailError?: string;
        };
        if (!res.ok) {
          setError(data.error || "Could not update member");
          return;
        }
        if (data.emailSent) {
          setNotice(
            `Member updated — changes emailed to ${email.trim()}${
              pin.trim() ? " (including the new PIN)" : ""
            }`,
          );
        } else {
          setError(
            data.emailError
              ? `Member updated, but email failed: ${data.emailError}`
              : "Member updated, but the update email could not be sent.",
          );
        }
        resetForm();
        await load();
        return;
      }

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
      resetForm();
      await load();
    } catch {
      setError(isEditing ? "Could not update member" : "Could not create member");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    if (editingId === id) resetForm();
    const res = await fetch(`/api/admins/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  const onToggleActive = async (admin: SafeAdmin) => {
    setNotice("");
    setError("");
    const res = await fetch(`/api/admins/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !admin.active }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      emailSent?: boolean;
      emailError?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error || "Could not update member");
      return;
    }
    if (data.emailSent && admin.email) {
      setNotice(
        `${admin.name} is now ${admin.active ? "paused" : "active"} — emailed ${admin.email}`,
      );
    } else if (data.emailError) {
      setError(`Status updated, but email failed: ${data.emailError}`);
    }
    await load();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-gold/20 bg-[#141018] p-5"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Pencil size={18} className="text-gold" />
            ) : (
              <UserPlus size={18} className="text-gold" />
            )}
            <h2 className="font-display text-2xl text-cream">
              {isEditing ? "Edit team member" : "Add team member"}
            </h2>
          </div>
          {isEditing ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded-full border border-gold/20 px-3 py-1.5 font-body text-[10px] uppercase tracking-wider text-muted hover:text-cream"
            >
              <X size={12} />
              Cancel
            </button>
          ) : null}
        </div>
        <p className="mb-5 font-body text-sm text-muted">
          {isEditing
            ? "Update name, email, permissions, or set a new PIN. First name is their login username. Leave PIN blank to keep the current one — they’ll get an update email either way."
            : "Email is required — they’ll get the dashboard link, first-name username, PIN, and access list from noreply@mail.technorapper.com."}
        </p>

        <label className="mb-3 block">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Full name (first name = username)
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
            {isEditing ? "New PIN (optional)" : "Their PIN"}
          </span>
          <input
            type="password"
            className={fieldClass}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            minLength={isEditing ? undefined : 4}
            required={!isEditing}
            placeholder={isEditing ? "Leave blank to keep current PIN" : ""}
          />
        </label>

        <p className="mb-2 font-body text-[10px] uppercase tracking-[0.2em] text-muted">
          Permissions / role
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
          {busy
            ? isEditing
              ? "Saving…"
              : "Saving & emailing…"
            : isEditing
              ? "Save changes"
              : "Create & email access"}
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
                  editingId === admin.id && "ring-1 ring-gold/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl text-cream">
                      {admin.name}
                    </p>
                    <p className="font-body text-[11px] uppercase tracking-[0.16em] text-muted">
                      Login: {memberUsername(admin.name) || "—"}
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
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(admin)}
                      className="inline-flex items-center gap-1 rounded-full border border-gold/25 px-3 py-1.5 font-body text-[10px] uppercase tracking-wider text-gold-soft"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
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
