export type Theme = 'light' | 'dark';

export interface ThemeConfig {
  name: string;
  displayName: string;
}

export const themes: Record<Theme, ThemeConfig> = {
  light: {
    name: 'light',
    displayName: '라이트 테마',
  },
  dark: {
    name: 'dark',
    displayName: '다크 테마',
  },
};

export const defaultTheme: Theme = 'light';

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function getTheme(): Theme {
  const root = document.documentElement;
  return root.classList.contains('dark') ? 'dark' : 'light';
}

