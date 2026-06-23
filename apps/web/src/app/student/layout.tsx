import AuthGuard from "@/components/AuthGuard";
import ConfirmProvider from "@/components/ConfirmProvider";
import ImageLightboxProvider from "@/components/ImageLightboxProvider";
import StudentShell from "@/components/StudentShell";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["STUDENT"]}>
      <ConfirmProvider>
        <ImageLightboxProvider>
          <StudentShell>{children}</StudentShell>
        </ImageLightboxProvider>
      </ConfirmProvider>
    </AuthGuard>
  );
}
