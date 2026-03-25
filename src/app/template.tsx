/**
 * Enveloppe racine : fond fixe pour éviter tout flash clair au changement de route
 * (pas d’animation d’opacité ici — le fond reste #0A0E17 en continu).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-1 flex-col bg-[#0A0E17]">
      {children}
    </div>
  );
}
