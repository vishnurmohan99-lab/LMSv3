"use client";

import { useEffect, useMemo, useState } from "react";
import { usersApi, mentorApi, ApiError, type Profile } from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

const ROLES: Profile["role"][] = ["STUDENT", "FACULTY", "ADMIN"];

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Profile["role"]>("FACULTY");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string; role: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function loadUsers() {
    setLoading(true);
    usersApi
      .list()
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }

  useEffect(loadUsers, []);

  function openAdd() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setRole("FACULTY");
    setCreated(null);
    setError(null);
    setShowAdd(true);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setCreating(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await usersApi.create({ fullName, email, password, role });
      setCreated({ email, password, role });
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setRole("FACULTY");
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create account");
    } finally {
      setCreating(false);
    }
  }

  async function onNameBlur(u: Profile, fullName: string) {
    if (!fullName.trim() || fullName === u.fullName) return;
    try {
      await usersApi.update(u.id, { fullName: fullName.trim() });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update name");
    }
  }

  async function onRoleChange(id: string, newRole: Profile["role"]) {
    setError(null);
    try {
      await usersApi.updateRole(id, newRole);
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update role");
    }
  }

  async function onToggleMentor(u: Profile) {
    setError(null);
    try {
      await mentorApi.setMentorFlag(u.id, { isMentor: !u.isMentor, specialty: u.mentorSpecialty ?? undefined });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update mentor status");
    }
  }

  async function onSpecialtyBlur(u: Profile, specialty: string) {
    if (!u.isMentor || specialty === (u.mentorSpecialty ?? "")) return;
    try {
      await mentorApi.setMentorFlag(u.id, { isMentor: true, specialty });
      loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update specialty");
    }
  }

  async function onCopyCredentials() {
    if (!created) return;
    await navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  return (
    <div style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>User Management</div>
        <button
          onClick={openAdd}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <PlusIcon />
          Add user
        </button>
      </div>

      {showAdd && (
        <Modal title="Add user" onClose={() => setShowAdd(false)}>
          <form onSubmit={onCreate} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <input required autoFocus placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            </div>
            <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <div style={{ display: "flex", gap: 6 }}>
              <input
                required
                type={showPassword ? "text" : "password"}
                minLength={8}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{ ...inputStyle, cursor: "pointer", fontSize: 12, color: "var(--ink2)" }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPassword(generatePassword());
                  setShowPassword(true);
                }}
                style={{ ...inputStyle, cursor: "pointer", fontSize: 12, color: "var(--orange)" }}
              >
                Generate
              </button>
            </div>
            <select value={role} onChange={(e) => setRole(e.target.value as Profile["role"])} style={inputStyle}>
              <option value="FACULTY">Faculty</option>
              <option value="ADMIN">Admin</option>
            </select>

            <button
              type="submit"
              disabled={creating}
              style={{
                padding: "11px 18px",
                background: "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                cursor: creating ? "default" : "pointer",
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating && <Spinner />}
              {creating ? "Creating…" : "Create"}
            </button>

            {created && (
              <div
                style={{
                  padding: 14,
                  background: "var(--green-soft)",
                  borderRadius: "var(--rm)",
                  color: "var(--green)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 12.5 }}>
                  <b>{created.role} account created.</b> Share these credentials now — the password won&apos;t be shown again.
                  <div style={{ marginTop: 4, fontFamily: "monospace" }}>
                    {created.email} / {created.password}
                  </div>
                </div>
                <button
                  onClick={onCopyCredentials}
                  style={{
                    padding: "8px 14px",
                    background: "var(--ink)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 9,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    flex: "none",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <section
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          padding: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>All users</div>
          <input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 260 }}
          />
        </div>
        {loading ? (
          <p style={{ color: "var(--ink2)" }}>Loading…</p>
        ) : filteredUsers.length === 0 ? (
          <p style={{ color: "var(--ink2)" }}>No users match.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink2)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "8px 6px" }}>Name</th>
                <th style={{ padding: "8px 6px" }}>Email</th>
                <th style={{ padding: "8px 6px" }}>Role</th>
                <th style={{ padding: "8px 6px" }}>Mentor</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--line2)" }}>
                  <td style={{ padding: "10px 6px" }}>
                    <input
                      defaultValue={u.fullName}
                      onBlur={(e) => onNameBlur(u, e.target.value)}
                      style={{
                        border: "1px solid transparent",
                        background: "transparent",
                        fontFamily: "inherit",
                        fontSize: 14,
                        padding: "4px 6px",
                        borderRadius: 7,
                        width: 160,
                      }}
                      onFocus={(e) => (e.target.style.border = "1px solid var(--line)")}
                    />
                  </td>
                  <td style={{ padding: "10px 6px" }}>{u.email}</td>
                  <td style={{ padding: "10px 6px" }}>
                    <select value={u.role} onChange={(e) => onRoleChange(u.id, e.target.value as Profile["role"])} style={inputStyle}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "10px 6px" }}>
                    {u.role === "FACULTY" ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5 }}>
                          <input type="checkbox" checked={!!u.isMentor} onChange={() => onToggleMentor(u)} style={{ accentColor: "var(--orange)" }} />
                          Mentor
                        </label>
                        {u.isMentor && (
                          <input
                            defaultValue={u.mentorSpecialty ?? ""}
                            placeholder="Specialty e.g. Front-end · 6y"
                            onBlur={(e) => onSpecialtyBlur(u, e.target.value)}
                            style={{ ...inputStyle, padding: "6px 10px", fontSize: 12.5, width: 180 }}
                          />
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "var(--ink3)", fontSize: 12.5 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
