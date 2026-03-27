import type { CSSProperties, ReactNode } from 'react';

export type AppContentShellProps = {
  variant?: 'narrow' | 'wide';
  as?: 'main' | 'div';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * Layout partagé pour les pages « contenu » (profil, admin, about, etc.).
 * Ne pas utiliser pour explore / timeline / tree / editor — vues plein écran.
 */
export function AppContentShell({
  variant = 'narrow',
  as: Component = 'div',
  className = '',
  style,
  children,
}: AppContentShellProps) {
  const maxW = variant === 'wide' ? 'max-w-6xl' : 'max-w-[720px]';
  return (
    <Component
      style={style}
      className={`mx-auto w-full ${maxW} bg-page px-8 pb-24 pt-28 sm:px-10 ${className}`.trim()}
    >
      {children}
    </Component>
  );
}
