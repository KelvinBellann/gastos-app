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

export const metadata = {
  title: "Gastos",
  description: "Controle de receitas e despesas por mês, com os dados guardados no próprio aparelho.",
};

// Sem maximumScale/userScalable: bloquear o zoom impede quem precisa ampliar a tela (WCAG 1.4.4)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceee9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e0b" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
