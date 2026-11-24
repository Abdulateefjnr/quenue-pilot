
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/app/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "QueuePilot | Smarter Queue. Better Care.",
    template: "%s | QueuePilot",
  },
  description:
    "QueuePilot helps healthcare facilities manage patient appointments, queues, and workflows for a better healthcare experience.",
  icons: {
    icon: "/Healthcare%20Queue%20Icon.png",
    shortcut: "/Healthcare%20Queue%20Icon.png",
    apple: "/Healthcare%20Queue%20Icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
