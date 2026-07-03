import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0a0a0f',
        panel: '#11121a',
        'panel-2': '#161826',
        line: 'rgba(148, 163, 253, 0.12)',
        neon: {
          cyan: '#22d3ee',
          violet: '#a78bfa',
          magenta: '#e879f9',
          green: '#34d399',
          amber: '#fbbf24',
          red: '#fb7185',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 24px rgba(34, 211, 238, 0.25)',
        'glow-violet': '0 0 24px rgba(167, 139, 250, 0.25)',
        'glow-green': '0 0 18px rgba(52, 211, 153, 0.35)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        scanline: 'scanline 9s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
