import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Smart AI Explorer',
  description: 'The Blockchain You Can Text',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
