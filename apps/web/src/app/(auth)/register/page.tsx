"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 14px",
  border: "1px solid var(--line)",
  borderRadius: 11,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
  boxSizing: "border-box",
};

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { user } = await authApi.register({ fullName, email, password });
      router.push(user.role === "STUDENT" ? "/student/dashboard" : "/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.6 }}>Create account</div>
      <p style={{ color: "var(--ink3)", fontSize: 14, margin: "8px 0 22px" }}>
        Start your free prep journey.
      </p>

      <div style={{ display: "grid", gap: 13 }}>
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          style={inputStyle}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          style={inputStyle}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm"
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 14 }}>{error}</p>}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          height: 46,
          marginTop: 20,
          background: "var(--orange)",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
          boxShadow: "0 2px 8px rgba(242,106,27,.3)",
        }}
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p style={{ textAlign: "center", fontSize: 14, color: "var(--ink2)", marginTop: 18 }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--orange)", fontWeight: 700 }}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
