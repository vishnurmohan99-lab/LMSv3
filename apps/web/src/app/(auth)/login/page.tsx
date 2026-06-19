"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi, usersApi, ApiError } from "@/lib/api";

const ROLE_HOME: Record<string, string> = {
  STUDENT: "/student/dashboard",
  FACULTY: "/faculty/dashboard",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  margin: "8px 0 16px",
  padding: "14px 16px",
  border: "1px solid var(--line)",
  borderRadius: 12,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersApi
      .me()
      .then((profile) => {
        const home = ROLE_HOME[profile.role];
        if (home) router.replace(home);
      })
      .catch(() => {});
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await authApi.login({ email, password });
      router.push(ROLE_HOME[user.role] ?? "/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.6 }}>Welcome back</div>
      <p style={{ color: "var(--ink3)", fontSize: 14, margin: "8px 0 28px" }}>
        Sign in to continue your prep.
      </p>

      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)" }}>Email</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={inputStyle}
      />

      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)" }}>Password</label>
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        style={{ ...inputStyle, marginBottom: 8 }}
      />

      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          padding: 15,
          background: "var(--ink)",
          color: "#fff",
          border: "none",
          borderRadius: 13,
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
          marginTop: 18,
        }}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p style={{ textAlign: "center", fontSize: 14, color: "var(--ink2)", marginTop: 22 }}>
        New here?{" "}
        <Link href="/register" style={{ color: "var(--orange)", fontWeight: 700 }}>
          Create account
        </Link>
      </p>
    </form>
  );
}
