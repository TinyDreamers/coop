import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coop Planner — 24-Bird Walk-In Coop + Run',
  description:
    'Design, price, visualize, and build one predator-proof chicken coop + run. Home Depot materials, Concord NH.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No maximumScale/userScalable lock — allow pinch-zoom so low-vision users can
  // magnify small text, SKUs, and the cut list on a phone.
  themeColor: '#734f30',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
