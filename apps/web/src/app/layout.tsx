import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import RiseSplash from "@/components/RiseSplash";

/**
 * iOS home-screen PWAs show a static launch image (apple-touch-startup-image) before the
 * web view paints; without one iOS shows a blank screen. One entry per current iPhone,
 * matched by its CSS point size and DPR. device px = points × dpr — the generated PNG for
 * each device carries the device-pixel dimensions. Landscape is omitted (the app is
 * portrait-locked in the manifest).
 */
const IPHONE_STARTUP = [
  { w: 375, h: 667, dpr: 2, px: "750-1334" },
  { w: 414, h: 896, dpr: 2, px: "828-1792" },
  { w: 375, h: 812, dpr: 3, px: "1125-2436" },
  { w: 390, h: 844, dpr: 3, px: "1170-2532" },
  { w: 393, h: 852, dpr: 3, px: "1179-2556" },
  { w: 428, h: 926, dpr: 3, px: "1284-2778" },
  { w: 430, h: 932, dpr: 3, px: "1290-2796" },
];
const startupImage = IPHONE_STARTUP.map(({ w, h, dpr, px }) => ({
  url: `/splash/apple-splash-${px}.png`,
  media: `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  applicationName: "Elearning",
  title: "Elearning — AI Exam Prep",
  description: "Study with intent. Rank with proof.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    // Kept "default": the app shell only pads safe-area-inset-bottom, so a translucent bar
    // would slide the header under the notch. iOS still shows the startup image on launch.
    statusBarStyle: "default",
    title: "Elearning",
    startupImage,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f26a1b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body style={{ fontFamily: "var(--font-jakarta), system-ui, sans-serif" }}>
        <RiseSplash />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
