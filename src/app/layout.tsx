import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "DevLens — Understand any codebase, instantly",
  description:
    "AI-powered codebase explorer. Generate interactive dependency graphs and chat with any GitHub repository.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[#0a0a0a]">
      <body className={`${inter.variable} font-sans min-h-screen bg-[#0a0a0a] text-[#f4f4f5] antialiased`}>
        {children}
      </body>
    </html>
  );
}
