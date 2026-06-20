import AuthGuard from "@/components/AuthGuard";
import ConfirmProvider from "@/components/ConfirmProvider";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["STUDENT"]}>
      <ConfirmProvider>{children}</ConfirmProvider>
    </AuthGuard>
  );
}
