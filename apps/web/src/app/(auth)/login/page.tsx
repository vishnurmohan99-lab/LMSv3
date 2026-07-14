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
  margin: "6px 0 16px",
  padding: "0 14px",
  height: 44,
  border: "1px solid var(--line)",
  borderRadius: 11,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
  boxSizing: "border-box",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      const { user } = await authApi.login({ email, password }, rememberMe);
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
      <div style={{ position: "relative" }}>
        <input
          type={showPassword ? "text" : "password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{ ...inputStyle, marginBottom: 8, paddingRight: 52 }}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          style={{
            position: "absolute",
            right: 6,
            top: 6,
            height: 32,
            padding: "0 10px",
            border: "none",
            background: "transparent",
            color: "var(--ink2)",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--ink2)",
          margin: "4px 0 2px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "var(--orange)", cursor: "pointer" }}
        />
        Remember me on this device
      </label>

      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          height: 46,
          background: "var(--orange)",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
          marginTop: 18,
          boxShadow: "0 2px 8px rgba(242,106,27,.3)",
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
