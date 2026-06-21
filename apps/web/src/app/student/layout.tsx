import AuthGuard from "@/components/AuthGuard";
import ConfirmProvider from "@/components/ConfirmProvider";
import StudentShell from "@/components/StudentShell";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["STUDENT"]}>
      <ConfirmProvider>
        <StudentShell>{children}</StudentShell>
      </ConfirmProvider>
    </AuthGuard>
  );
}
