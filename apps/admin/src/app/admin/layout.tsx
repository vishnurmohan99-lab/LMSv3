import AuthGuard from "@/components/AuthGuard";
import AdminShell from "@/components/AdminShell";
import ConfirmProvider from "@/components/ConfirmProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <ConfirmProvider>
        <AdminShell>{children}</AdminShell>
      </ConfirmProvider>
    </AuthGuard>
  );
}
