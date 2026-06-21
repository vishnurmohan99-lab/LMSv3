"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authApi, usersApi, messengerApi, type Profile } from "@/lib/api";

function Icon({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "flex", width: 18, justifyContent: "center", flex: "none" }}>{children}</span>;
}

function OverviewIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
function CourseIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="M21 12v5a2 2 0 0 1-1 1.7l-7 3.3-7-3.3A2 2 0 0 1 3 17v-5" />
    </svg>
  );
}
function CalendarIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function MessagesIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </svg>
  );
}
function ForumIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="9" cy="10" r="5" />
      <path d="M2 21c0-3 2.5-5 7-5s7 2 7 5M16 8.5a3.5 3.5 0 1 1 4 3.46M19.5 14c2 .3 3.5 1.5 3.5 3.5" />
    </svg>
  );
}
function FeedbackIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M4 4v12a1 1 0 0 0 1 1h4l3 4 3-4h4a1 1 0 0 0 1-1V6a2 2 0 0 0-2-2H5a1 1 0 0 0-1 1Z" />
    </svg>
  );
}
function WorkoutIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M6.5 6.5 17.5 17.5M5 19l-2-2M19 5l2 2M9 5 5 9M19 15l-4 4" />
    </svg>
  );
}
function MockTestIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M9 11l2 2 4-4" />
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}
function MentorIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function PlannerIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 13h2M14 13h2M8 17h2M14 17h2" />
    </svg>
  );
}
function SubscriptionIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </svg>
  );
}
function ProfileIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function SettingsIcon({ c }: { c: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
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
function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

const navItems = [
  { href: "/student/dashboard", label: "Overview", Icon: OverviewIcon, enabled: true },
  { href: "/student/courses", label: "Course", Icon: CourseIcon, enabled: true },
  { href: "/student/calendar", label: "Calendar", Icon: CalendarIcon, enabled: false },
  { href: "/student/messages", label: "Messages", Icon: MessagesIcon, enabled: true },
  { href: "/student/forum", label: "Forum", Icon: ForumIcon, enabled: false },
  { href: "/student/feedback", label: "Feedback", Icon: FeedbackIcon, enabled: true },
  { href: "/student/workout", label: "Workout", Icon: WorkoutIcon, enabled: true },
  { href: "/student/mock-test", label: "Mock Test", Icon: MockTestIcon, enabled: true },
  { href: "/student/mentor", label: "Mentor", Icon: MentorIcon, enabled: true },
  { href: "/student/planner", label: "Planner", Icon: PlannerIcon, enabled: false },
  { href: "/student/subscription", label: "Subscription", Icon: SubscriptionIcon, enabled: false },
];

function navStyle(active: boolean, enabled: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 14px",
    border: "none",
    background: active ? "var(--ink)" : "transparent",
    color: active ? "#fff" : enabled ? "var(--ink2)" : "var(--ink3)",
    fontSize: 14,
    fontWeight: active ? 700 : 600,
    borderRadius: 12,
    fontFamily: "inherit",
    textAlign: "left",
    marginBottom: 3,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.55,
    justifyContent: "space-between",
  };
}

export default function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    function poll() {
      messengerApi.getUnreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
    }
    poll();
    const interval = setInterval(poll, 20000);
    return () => clearInterval(interval);
  }, []);

  async function onLogout() {
    await authApi.logout();
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) router.push(`/student/courses?q=${encodeURIComponent(search.trim())}`);
  }

  const sectionTitle = navItems.find((n) => isActive(n.href))?.label ?? "Overview";

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
        <div style={{ display: "flex", alignItems: "center", gap: 9, width: 168 }}>
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
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.5 }}>Paperlms</span>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{sectionTitle}</div>

        <form onSubmit={onSearchSubmit} style={{ position: "relative", flex: "1 1 320px", maxWidth: 380, marginLeft: 18 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a course that interests you"
            style={{
              width: "100%",
              padding: "10px 42px 10px 16px",
              border: "1px solid var(--line)",
              borderRadius: 999,
              fontSize: 13.5,
              fontFamily: "inherit",
              outline: "none",
              background: "var(--bg)",
            }}
          />
          <button type="submit" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <SearchIcon />
          </button>
        </form>

        <div style={{ flex: 1 }} />

        <Link
          href="/student/messages"
          style={{
            position: "relative",
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                background: "var(--orange)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 999,
                minWidth: 17,
                height: 17,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 3px",
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        {profile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "5px 14px 5px 5px",
              border: "1px solid var(--line)",
              borderRadius: 999,
              flex: "none",
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
            <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>{profile.fullName}</span>
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
          {navItems.map(({ href, label, Icon: ItemIcon, enabled }) => {
            const active = isActive(href);
            const color = active ? "#fff" : enabled ? "var(--ink2)" : "var(--ink3)";
            const content = (
              <>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Icon>
                    <ItemIcon c={color} />
                  </Icon>
                  <span>{label}</span>
                </span>
                {!enabled && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink3)", background: "var(--bg)", padding: "2px 7px", borderRadius: 6 }}>
                    SOON
                  </span>
                )}
              </>
            );
            return enabled ? (
              <Link key={href} href={href} style={navStyle(active, enabled)}>
                {content}
              </Link>
            ) : (
              <div key={href} title="Coming soon" style={navStyle(active, enabled)}>
                {content}
              </div>
            );
          })}

          <div style={{ flex: 1 }} />

          <Link href="/student/profile" style={navStyle(isActive("/student/profile"), true)}>
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Icon>
                <ProfileIcon c={isActive("/student/profile") ? "#fff" : "var(--ink2)"} />
              </Icon>
              <span>Profile</span>
            </span>
          </Link>
          <div title="Coming soon" style={navStyle(false, false)}>
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Icon>
                <SettingsIcon c="var(--ink3)" />
              </Icon>
              <span>Settings</span>
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink3)", background: "var(--bg)", padding: "2px 7px", borderRadius: 6 }}>SOON</span>
          </div>
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
