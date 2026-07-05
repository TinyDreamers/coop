import type { Config } from 'tailwindcss';

/**
 * Construction-planning inspired palette: warm timber tones + a "blueprint"
 * accent, high-contrast, large tap targets. Kept intentionally small so the
 * UI reads as a practical jobsite tool, not a marketing site.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        timber: {
          50: '#faf7f2',
          100: '#f2ebdf',
          200: '#e4d5bf',
          300: '#d2b892',
          400: '#bd9663',
          500: '#a97d47',
          600: '#8f6539',
          700: '#734f30',
          800: '#5f412c',
          900: '#513728',
        },
        blueprint: {
          50: '#eef6ff',
          100: '#d9ecff',
          200: '#bcdcff',
          300: '#8ec6ff',
          400: '#59a5ff',
          500: '#3282f6',
          600: '#1f63eb',
          700: '#194ed8',
          800: '#1b41af',
          900: '#1c3a8a',
        },
        moss: {
          50: '#f3f8f2',
          100: '#e2efe0',
          500: '#4f9c50',
          600: '#3d7d40',
          700: '#336536',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)',
        pop: '0 10px 30px rgba(16,24,40,0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
