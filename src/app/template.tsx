/**
 * Enveloppe racine : fond aligné sur les tokens de thème (script inline + CSS vars).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-1 flex-col bg-page">
      {children}
    </div>
  );
}
