import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./sw-register";
import DevConsole from "./components/DevConsole";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata = {
  title: "PulseChat",
  description: "PulseChat cross-platform messaging.",
  manifest: "/manifest.webmanifest",
  themeColor: "#5EC7D9",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} antialiased`}>
        {children}
        <ServiceWorkerRegister />
        <DevConsole />
      </body>
    </html>
  );
}
