import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AetherStation",
  description: "Apple-inspired PS1 desktop emulator built with Electron, Next.js, and Tailwind CSS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body>{children}</body>
    </html>
  );
}
