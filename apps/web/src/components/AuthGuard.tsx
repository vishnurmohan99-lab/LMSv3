"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usersApi, type Profile } from "@/lib/api";

export default function AuthGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: Profile["role"][];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .me()
      .then((profile) => {
        if (cancelled) return;
        if (!allowedRoles.includes(profile.role)) {
          router.replace("/login");
          return;
        }
        setAuthorized(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authorized) {
    return (
      <div style={{ padding: 40, color: "var(--ink2)" }}>Loading…</div>
    );
  }

  return <>{children}</>;
}
