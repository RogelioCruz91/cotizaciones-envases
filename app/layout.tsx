import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cotizaciones de Envases",
  description: "Sistema de cotizaciones para envases de alimentos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="flex h-screen bg-slate-900 text-white overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto flex flex-col">{children}</main>
      </body>
    </html>
  );
}
