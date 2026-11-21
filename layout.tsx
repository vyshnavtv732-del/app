import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Frame — AI Video Clipper", description: "Turn long-form videos into moments people want to watch." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
