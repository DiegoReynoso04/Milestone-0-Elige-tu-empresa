import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Backoffice · Nexova',
  description: 'Panel interno de Nexova Solutions — punto de entrada para las herramientas de operación de la empresa.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full">
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink antialiased">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <span className="text-sm font-semibold tracking-tight text-ink">
              Nexova <span className="text-ink-muted">· Backoffice</span>
            </span>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
