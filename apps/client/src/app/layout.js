import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./sw-register";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata = {
  title: "PulseChat",
  description: "A realtime chat MVP inspired by WhatsApp.",
  manifest: "/manifest.webmanifest",
  themeColor: "#25d366",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} antialiased`}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
