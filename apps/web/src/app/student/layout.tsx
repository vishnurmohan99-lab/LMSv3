import AuthGuard from "@/components/AuthGuard";
import ConfirmProvider from "@/components/ConfirmProvider";
import ImageLightboxProvider from "@/components/ImageLightboxProvider";
import OnboardingGate from "@/components/OnboardingGate";
import StudentShell from "@/components/StudentShell";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["STUDENT"]}>
      <ConfirmProvider>
        <ImageLightboxProvider>
          <OnboardingGate>
            <StudentShell>{children}</StudentShell>
          </OnboardingGate>
        </ImageLightboxProvider>
      </ConfirmProvider>
    </AuthGuard>
  );
}
