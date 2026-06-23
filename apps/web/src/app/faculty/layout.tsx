import AuthGuard from "@/components/AuthGuard";
import ConfirmProvider from "@/components/ConfirmProvider";
import ImageLightboxProvider from "@/components/ImageLightboxProvider";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["FACULTY"]}>
      <ConfirmProvider>
        <ImageLightboxProvider>{children}</ImageLightboxProvider>
      </ConfirmProvider>
    </AuthGuard>
  );
}
