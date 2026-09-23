'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface NavLinkProps {
  href: string;
  children: ReactNode;
}

// Enlace de navegación que marca la página actual con aria-current (y con un
// subrayado, para no depender solo del color). usePathname exige cliente.
export function NavLink({ href, children }: NavLinkProps) {
  const isCurrent = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      className={`rounded-control px-1 text-sm font-medium outline-none hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        isCurrent ? 'text-ink underline decoration-2 underline-offset-8' : 'text-ink-muted'
      }`}
    >
      {children}
    </Link>
  );
}
