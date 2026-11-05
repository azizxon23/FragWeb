import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "FragWeb — Good fragrances deserve a second story", description: "Discover and sell pre-owned perfumes in Uzbekistan. Your next signature scent, for a little less.", icons: {icon: "/favicon.svg"} };
export default function RootLayout({children}: {children: React.ReactNode}) {return <html lang="en"><head><script src="https://telegram.org/js/telegram-web-app.js" /></head><body>{children}</body></html>}
