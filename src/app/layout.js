import "./globals.css";

export const metadata = {
  title: "Yacht Solutions — Carnet de chantier",
  description: "Gestion des bateaux, techniciens et tâches de chantier",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-cream text-inktext font-sans">{children}</body>
    </html>
  );
}
