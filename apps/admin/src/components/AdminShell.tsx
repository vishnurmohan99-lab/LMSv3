"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authApi, usersApi, messengerApi, type Profile } from "@/lib/api";

function Icon({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "flex", width: 18, justifyContent: "center" }}>{children}</span>;
}

function DashboardIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function SegmentsIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

function CoursesIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="M21 12v5a2 2 0 0 1-1 1.7l-7 3.3-7-3.3A2 2 0 0 1 3 17v-5" />
    </svg>
  );
}

function QuestionBankIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4" />
      <circle cx="12" cy="17" r=".6" fill={c} stroke="none" />
    </svg>
  );
}

function TestsIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M9 11l2 2 4-4" />
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}

function BatchStatusIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="8" cy="8" r="2.5" />
      <circle cx="16" cy="8" r="2.5" />
      <circle cx="8" cy="16" r="2.5" />
      <circle cx="16" cy="16" r="2.5" />
    </svg>
  );
}

function MessagesIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 11a4 4 0 0 0 0-8M22 21c0-3-2-5.5-5-6" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function FeedbackIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function SubscriptionsIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function ForumIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M17 8h2a2 2 0 0 1 2 2v9l-3-2H9a2 2 0 0 1-2-2v-1" />
      <path d="M3 4h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2l-3 2V6" />
    </svg>
  );
}

function PlannerIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 13h2M14 13h2M8 17h2M14 17h2" />
    </svg>
  );
}

function ReportsIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M3 3v18h18" />
      <path d="M7 16v-4M12 16V8M17 16v-7" />
    </svg>
  );
}

function AnswerCorrectionIcon({ active }: { active: boolean }) {
  const c = active ? "var(--orange-deep)" : "var(--ink2)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" />
      <path d="M14 3v6h6" />
      <path d="m9 14 2 2 4-4" />
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
  { href: "/admin/question-banks", label: "Question Banks", Icon: QuestionBankIcon },
  { href: "/admin/tests", label: "Tests", Icon: TestsIcon },
  { href: "/admin/answer-correction", label: "Answer Correction", Icon: AnswerCorrectionIcon },
  { href: "/admin/batches", label: "Batches", Icon: BatchStatusIcon },
  { href: "/admin/subscriptions", label: "Subscriptions", Icon: SubscriptionsIcon },
  { href: "/admin/messages", label: "Messages", Icon: MessagesIcon },
  { href: "/admin/feedback", label: "Feedback", Icon: FeedbackIcon },
  { href: "/admin/forum", label: "Forum", Icon: ForumIcon },
  { href: "/admin/reports", label: "Reports", Icon: ReportsIcon },
  { href: "/admin/planner", label: "Planner", Icon: PlannerIcon },
  { href: "/admin/users", label: "Users", Icon: UsersIcon },
  { href: "/admin/settings", label: "Settings", Icon: SettingsIcon },
];

function navStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 14px",
    border: "none",
    background: active ? "var(--orange-soft)" : "transparent",
    color: active ? "var(--orange-deep)" : "var(--ink2)",
    fontSize: 14,
    fontWeight: active ? 700 : 600,
    borderRadius: "var(--rs)",
    fontFamily: "inherit",
    textAlign: "left",
    marginBottom: 3,
  };
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

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
    // Batch Statuses and Tags moved out of the nav into the Batches / Tests pages —
    // keep the parent nav item highlighted while on those sub-pages.
    if (href === "/admin/batches" && pathname?.startsWith("/admin/batch-statuses")) return true;
    if (href === "/admin/tests" && pathname?.startsWith("/admin/tags")) return true;
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
              background: "linear-gradient(135deg,#fb8a44,#e0540e)",
              transform: "rotate(45deg)",
              flex: "none",
            }}
          />
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.5 }}>Elearning</span>
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
                background: "linear-gradient(135deg,#fb8a44,#e0540e)",
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
              <Link key={href} href={href} style={{ ...navStyle(active), justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Icon>
                    <ItemIcon active={active} />
                  </Icon>
                  <span>{label}</span>
                </span>
                {href === "/admin/messages" && unreadCount > 0 && (
                  <span
                    style={{
                      background: "var(--orange)",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "1px 7px",
                      minWidth: 18,
                      textAlign: "center",
                    }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
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
