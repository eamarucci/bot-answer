import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BotAnswer Admin',
  description: 'Gerencie suas chaves API e usuarios do BotAnswer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
