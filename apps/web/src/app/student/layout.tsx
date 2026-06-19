import AuthGuard from "@/components/AuthGuard";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRoles={["STUDENT"]}>{children}</AuthGuard>;
}
