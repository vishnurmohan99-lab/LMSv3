import AuthGuard from "@/components/AuthGuard";
import ConfirmProvider from "@/components/ConfirmProvider";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["FACULTY"]}>
      <ConfirmProvider>{children}</ConfirmProvider>
    </AuthGuard>
  );
}
