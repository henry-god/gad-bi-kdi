import type { Metadata } from 'next';
import '../frontend/styles/globals.css';
import AuthBoundary from './_components/AuthBoundary';

export const metadata: Metadata = {
  title: 'KGD - ប្រព័ន្ធឯកសារឆ្លាតវៃ',
  description: 'Khmer Government Document Intelligence Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="km" className="dark">
      <body className="font-ui bg-kgd-bg text-kgd-text min-h-screen antialiased">
        <AuthBoundary>{children}</AuthBoundary>
      </body>
    </html>
  );
}
