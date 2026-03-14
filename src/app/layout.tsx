import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "../index.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://halo-psdm.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Halo PSDM - ARSC FTP UB | Sistem Laporan, Curhat, dan Janji Temu",
    template: "%s | Halo PSDM - ARSC FTP UB",
  },
  description:
    "Halo PSDM ARSC adalah platform komunikasi dua arah untuk pelaporan, sesi curhat, dan permintaan janji temu antara anggota dan PSDM secara cepat, aman, dan terdokumentasi.",
  keywords: [
    "Halo PSDM",
    "ARSC",
    "PSDM ARSC",
    "sistem pelaporan organisasi",
    "pengaduan anggota",
    "chat internal organisasi",
    "janji temu PSDM",
    "manajemen kasus organisasi",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "Halo PSDM - ARSC FTP UB",
    title: "Halo PSDM - ARSC FTP UB | Sistem Laporan, Curhat, dan Janji Temu",
    description:
      "Platform komunikasi dua arah Divisi PSDM ARSC untuk pelaporan, curhat, dan janji temu secara terstruktur dan terdokumentasi.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Halo PSDM - ARSC FTP UB | Sistem Laporan, Curhat, dan Janji Temu",
    description:
      "Platform komunikasi dua arah Divisi PSDM ARSC untuk pelaporan, curhat, dan janji temu secara terstruktur dan terdokumentasi.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
