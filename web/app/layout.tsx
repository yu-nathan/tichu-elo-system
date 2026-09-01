import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tichu-elo.nyu1997.chatgpt.site"),
  title: "Tichu Elo Leaderboard",
  description:
    "Track Tichu Elo ratings, recent games, and generate balanced or randomized teams.",
  alternates: { canonical: "/" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Tichu Elo",
    title: "Tichu Elo Leaderboard",
    description:
      "Live standings, recent results, and quick matchmaking for our Tichu group.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Tichu Elo leaderboard and matchmaker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tichu Elo Leaderboard",
    description:
      "Live standings, recent results, and quick matchmaking for our Tichu group.",
    images: ["/og.png"],
  },
};

const RootLayout = ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
