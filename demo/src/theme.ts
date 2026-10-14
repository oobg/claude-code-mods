import { createContext, useContext } from 'react'

// dashboard의 everforest 색 구성. GitHub 다크와 라이트 테마에 맞춰 두 벌을 렌더링한다.
export type Palette = {
  page: string
  panel: string
  text: string
  dim: string
  accent: string
  green: string
  yellow: string
  orange: string
  red: string
  hit: string
  key: string
}

export const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    page: '#1e2326',
    panel: '#272e33',
    text: '#d3c6aa',
    dim: '#859289',
    accent: '#7fbbb3',
    green: '#a7c080',
    yellow: '#dbbc7f',
    orange: '#e69875',
    red: '#e67e80',
    hit: 'rgba(127, 187, 179, 0.22)',
    key: '#dbbc7f',
  },
  light: {
    page: '#f8f5e4',
    panel: '#fffbef',
    text: '#5c6a72',
    dim: '#939f91',
    accent: '#3a94c5',
    green: '#8da101',
    yellow: '#dfa000',
    orange: '#f57d26',
    red: '#f85552',
    hit: 'rgba(58, 148, 197, 0.16)',
    key: '#dfa000',
  },
}

export type Theme = keyof typeof PALETTES

export const ThemeContext = createContext<Palette>(PALETTES.dark)
export const usePalette = () => useContext(ThemeContext)

export const FONT = "'D2Coding', 'Menlo', monospace"
