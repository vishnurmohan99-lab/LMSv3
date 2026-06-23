import AuthGuard from "@/components/AuthGuard";
import AdminShell from "@/components/AdminShell";
import ConfirmProvider from "@/components/ConfirmProvider";
import ImageLightboxProvider from "@/components/ImageLightboxProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <ConfirmProvider>
        <ImageLightboxProvider>
          <AdminShell>{children}</AdminShell>
        </ImageLightboxProvider>
      </ConfirmProvider>
    </AuthGuard>
  );
}
