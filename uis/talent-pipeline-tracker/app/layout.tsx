import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/toast-notification';
import './globals.css';

export const metadata: Metadata = {
  title: 'Talent Pipeline Tracker · Nexova',
  description: 'Gestión interna de candidaturas — Operaciones de Selección, Nexova Solutions.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full">
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
