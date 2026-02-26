import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FieldDive | Roofing Estimator & Contractor Tools",
  description:
    "FieldDive provides instant roofing estimates, professional proposals, approval tracking, and contractor revenue tools.",
  metadataBase: new URL("https://www.fielddive.com"),

  openGraph: {
    title: "FieldDive",
    description:
      "Instant roofing estimates, proposals, and contractor approval tracking.",
    url: "https://www.fielddive.com",
    siteName: "FieldDive",
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "FieldDive",
    description:
      "Instant roofing estimates and contractor revenue tools.",
  },

  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#070A12] text-white">{children}</body>
    </html>
  );
}
