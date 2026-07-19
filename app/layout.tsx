import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Local pixel-art font (not Google Fonts) — a scalable TrueType remake of the
// hardware VGA text-mode character set. The "True" (not "_437") variant is
// required: it has the extended Latin set that covers Turkish diacritics
// (ç, ğ, ı, ö, ş, ü), which the CP437-only "_437" variant lacks.
const pixelFont = localFont({
  src: "../font/flexi_ibm_vga_true2/Flexi_IBM_VGA_True.ttf",
  variable: "--font-pixel",
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
  title: "Kurultay",
  description: "Karakter kartlarıyla oynanan çok oyunculu senaryo yarışması",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${pixelFont.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-dominant text-secondary">{children}</body>
    </html>
  );
}
