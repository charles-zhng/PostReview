import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { Footer, Nav } from "@/components/Chrome";
import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "fallback",
});

export const metadata: Metadata = {
  title: "PostReview",
  description: "Open peer review of viral AI posts, by synthetic reviewers.",
  // Unannounced for now: keep search engines from listing it.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={notoSans.className}>
        <div id="root">
          <Nav />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
