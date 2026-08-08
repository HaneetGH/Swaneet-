"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || undefined,
          pin,
        }),
      });
      if (!res.ok) {
        setError(
          username.trim()
            ? "Incorrect username or PIN"
            : "Incorrect master PIN",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-sm rounded-2xl border border-gold/25 bg-[#141018] p-8 shadow-[0_0_40px_-16px_rgba(212,175,55,0.35)]"
    >
      <p className="font-body text-[10px] uppercase tracking-[0.35em] text-gold/70">
        Admin access
      </p>
      <h1 className="mt-3 font-display text-3xl text-cream">Dashboard</h1>
      <p className="mt-2 font-body text-sm text-muted">
        Team (including photographers): enter your first name + PIN from the
        invite email. Master: leave username blank and use the master PIN.
      </p>

      <label
        htmlFor="username"
        className="mt-8 block font-body text-xs uppercase tracking-[0.2em] text-muted"
      >
        Username (first name)
      </label>
      <input
        id="username"
        type="text"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-4 py-3 font-body text-cream outline-none focus:border-gold/60"
        placeholder="Leave blank for master"
      />

      <label
        htmlFor="pin"
        className="mt-5 block font-body text-xs uppercase tracking-[0.2em] text-muted"
      >
        PIN
      </label>
      <input
        id="pin"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-4 py-3 font-body text-cream outline-none focus:border-gold/60"
        placeholder="••••••••"
        required
      />
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

      <Button type="submit" disabled={loading} className="mt-6 w-full">
        {loading ? "Checking…" : "Enter dashboard"}
      </Button>
    </form>
  );
}
