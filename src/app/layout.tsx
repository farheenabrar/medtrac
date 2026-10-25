import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Medtrac - Cross-Border Metabolic Tracking',
  description:
    'Organises your scattered international lab reports into one unified picture for your doctor in under 5 minutes.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900 flex flex-col">
        <Navigation />

        <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 pb-24 sm:pb-8">
          {children}
        </main>

        <footer className="no-print border-t border-slate-200/80 py-6 bg-white/80 backdrop-blur-xs text-center text-xs text-slate-500 mb-16 sm:mb-0">
          <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5 justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Organises your records. Not medical advice.
            </p>
            <p className="text-slate-400">
              Medtrac &copy; {new Date().getFullYear()} — Built for metabolic reviews across Mumbai, Dubai &amp; worldwide.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
