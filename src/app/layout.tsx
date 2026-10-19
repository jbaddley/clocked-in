import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Nunito_Sans, Source_Sans_3 } from "next/font/google";
import { Providers } from "@/components/providers";
import { defaultIcons } from "@/lib/favicon";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  preload: false,
});

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Clocked In", template: "%s · Clocked In" },
  description: "Log volunteer hours, value them for grants, and report on impact.",
  icons: defaultIcons,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${sourceSans.variable} ${nunito.variable} ${geistMono.variable} h-full antialiased has-[[data-section-layout]]:overflow-hidden`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
