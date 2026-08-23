import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta Sortea: oscuro + acento violeta/verde (neutral entre Twitch y Kick)
        surface: {
          DEFAULT: '#0b0b12',
          raised:  '#14141f',
          border:  '#23233a',
        },
        brand: {
          DEFAULT: '#8b5cf6',
          hover:   '#7c3aed',
          kick:    '#53fc18',
          twitch:  '#9146ff',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
