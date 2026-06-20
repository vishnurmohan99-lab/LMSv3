"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authApi, usersApi, type Profile } from "@/lib/api";

function Icon({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "flex", width: 18, justifyContent: "center" }}>{children}</span>;
}

function DashboardIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function SegmentsIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

function CoursesIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="M21 12v5a2 2 0 0 1-1 1.7l-7 3.3-7-3.3A2 2 0 0 1 3 17v-5" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 11a4 4 0 0 0 0-8M22 21c0-3-2-5.5-5-6" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const c = active ? "#fff" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.8">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/admin/segments", label: "Segments", Icon: SegmentsIcon },
  { href: "/admin/courses", label: "Courses", Icon: CoursesIcon },
  { href: "/admin/users", label: "Users", Icon: UsersIcon },
];

function navStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 14px",
    border: "none",
    background: active ? "var(--ink)" : "transparent",
    color: active ? "#fff" : "var(--ink2)",
    fontSize: 14,
    fontWeight: active ? 700 : 600,
    borderRadius: 12,
    fontFamily: "inherit",
    textAlign: "left",
    marginBottom: 3,
  };
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => {});
  }, []);

  async function onLogout() {
    await authApi.logout();
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          height: 72,
          flex: "none",
          background: "var(--card)",
          display: "flex",
          alignItems: "center",
          padding: "0 26px",
          gap: 22,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, width: 188 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "linear-gradient(135deg,#f7902b,#f24d1b)",
              transform: "rotate(45deg)",
              flex: "none",
            }}
          />
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.5 }}>duvex</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Admin</div>
        <div style={{ flex: 1 }} />
        {profile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "5px 14px 5px 5px",
              border: "1px solid var(--line)",
              borderRadius: 999,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#f7902b,#f24d1b)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {profile.fullName.slice(0, 2).toUpperCase()}
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{profile.fullName}</span>
          </div>
        )}
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <aside
          style={{
            width: 188,
            flex: "none",
            background: "var(--card)",
            borderRight: "1px solid var(--line)",
            padding: "18px 14px",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {navItems.map(({ href, label, Icon: ItemIcon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} style={navStyle(active)}>
                <Icon>
                  <ItemIcon active={active} />
                </Icon>
                <span>{label}</span>
              </Link>
            );
          })}

          <div style={{ flex: 1 }} />

          <Link href="/admin/profile" style={navStyle(isActive("/admin/profile"))}>
            <Icon>
              <ProfileIcon active={isActive("/admin/profile")} />
            </Icon>
            <span>Profile</span>
          </Link>
          <button
            onClick={onLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 14px",
              border: "none",
              background: "transparent",
              color: "var(--orange)",
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 12,
              fontFamily: "inherit",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Icon>
              <LogoutIcon />
            </Icon>
            <span>Logout</span>
          </button>
        </aside>

        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
