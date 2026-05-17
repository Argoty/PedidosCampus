import type { Metadata } from "next";
import { Inter, Outfit, Fira_Code } from "next/font/google";
import { AuthProvider } from "../context/AuthContext";
import { Shell } from "../components/layout/Shell";
import "./globals.css";

const fontSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontHeading = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
});

const fontMono = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PedidosCampus",
  description: "Plataforma de pedidos y entregas para el entorno universitario",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <Shell>
            {children}
          </Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
