import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'KGD - ប្រព័ន្ធឯកសារឆ្លាតវៃ',
  description: 'Khmer Government Document Intelligence Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="km">
      <body className="font-khmer bg-kgd-cream min-h-screen">
        {children}
      </body>
    </html>
  );
}
