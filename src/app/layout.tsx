import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "RAINRADAR | Know Before It Rains", description: "Live UAE forecasts, rain tracking and weather awareness" };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en" suppressHydrationWarning><body>{children}</body></html>}