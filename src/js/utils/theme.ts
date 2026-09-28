import { getStoredItem, setStoredItem } from './safe-storage.js';

export type ThemeId =
  | 'classic-dark'
  | 'tokyo-newsprint'
  | 'swiss-typographic'
  | 'urushi-lacquer'
  | 'gruvbox-heritage'
  | 'nordic-fjord';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  mode: 'dark' | 'light';
  inspiration: string;
  colors: {
    base: string;
    surface: string;
    border: string;
    text: string;
    accent: string;
  };
}

const STORAGE_KEY = 'bentopdf-theme';
const DEFAULT_THEME: ThemeId = 'classic-dark';

const THEMES: ThemeInfo[] = [
  {
    id: 'classic-dark',
    name: 'Bento Classic',
    mode: 'dark',
    inspiration: 'Default dark modern layout',
    colors: {
      base: '#111827',
      surface: '#1f2937',
      border: '#374151',
      text: '#ffffff',
      accent: '#6366f1',
    },
  },
  {
    id: 'tokyo-newsprint',
    name: 'Tokyo Newsprint',
    mode: 'light',
    inspiration: 'Japanese editorial and print layout',
    colors: {
      base: '#F5F2EB',
      surface: '#EDE8DF',
      border: '#D8D2C4',
      text: '#1A1D20',
      accent: '#E64A2E',
    },
  },
  {
    id: 'swiss-typographic',
    name: 'Swiss Typographic',
    mode: 'light',
    inspiration: 'International Typographic Style / Clean Swiss grid',
    colors: {
      base: '#ECEEF0',
      surface: '#F8F9FA',
      border: '#D0D5DD',
      text: '#0D121C',
      accent: '#0066FF',
    },
  },
  {
    id: 'urushi-lacquer',
    name: 'Urushi Lacquer',
    mode: 'dark',
    inspiration: 'Traditional Japanese urushi lacquerware',
    colors: {
      base: '#0F0E0E',
      surface: '#1A1817',
      border: '#2E2A28',
      text: '#EDE6DE',
      accent: '#D9483B',
    },
  },
  {
    id: 'gruvbox-heritage',
    name: 'Gruvbox Heritage',
    mode: 'dark',
    inspiration: 'Warm retro terminal color scheme',
    colors: {
      base: '#1D1B19',
      surface: '#282522',
      border: '#3C3833',
      text: '#EBDBB2',
      accent: '#FE8019',
    },
  },
  {
    id: 'nordic-fjord',
    name: 'Nordic Fjord',
    mode: 'dark',
    inspiration: 'Minimalist Arctic twilight palette',
    colors: {
      base: '#0B0F14',
      surface: '#141C24',
      border: '#22303E',
      text: '#E6EDF3',
      accent: '#00D2B4',
    },
  },
];

const THEME_IDS: Set<string> = new Set(THEMES.map((t) => t.id));
let transitionTimeout: ReturnType<typeof setTimeout> | null = null;

export const getAvailableThemes = (): ThemeInfo[] => [...THEMES];

export const getStoredTheme = (): ThemeId => {
  const stored = getStoredItem(STORAGE_KEY);
  if (stored && THEME_IDS.has(stored)) {
    return stored as ThemeId;
  }
  return DEFAULT_THEME;
};

export const getCurrentTheme = (): ThemeId => {
  const current = document.documentElement.getAttribute('data-theme');
  if (current && THEME_IDS.has(current)) {
    return current as ThemeId;
  }
  return getStoredTheme();
};

export const setTheme = (
  themeId: ThemeId,
  options: { transition?: boolean } = {}
): void => {
  const targetTheme = THEME_IDS.has(themeId) ? themeId : DEFAULT_THEME;
  const themeInfo = THEMES.find((t) => t.id === targetTheme) || THEMES[0];
  const root = document.documentElement;

  if (options.transition) {
    if (transitionTimeout) clearTimeout(transitionTimeout);
    root.classList.add('theme-transitioning');
    transitionTimeout = setTimeout(() => {
      root.classList.remove('theme-transitioning');
      transitionTimeout = null;
    }, 300);
  }

  root.setAttribute('data-theme', targetTheme);

  // Remove existing theme-* classes and add the target theme class
  THEMES.forEach((t) => {
    root.classList.remove(`theme-${t.id}`);
  });
  root.classList.add(`theme-${targetTheme}`);

  if (themeInfo.mode === 'light') {
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
  }

  setStoredItem(STORAGE_KEY, targetTheme);

  window.dispatchEvent(
    new CustomEvent('themechange', {
      detail: { themeId: targetTheme, themeInfo },
    })
  );
};

export const initTheme = (): void => {
  const initialTheme = getStoredTheme();
  setTheme(initialTheme, { transition: false });
};

export const cycleTheme = (): ThemeId => {
  const current = getCurrentTheme();
  const currentIndex = THEMES.findIndex((t) => t.id === current);
  const nextIndex = (currentIndex + 1) % THEMES.length;
  const nextTheme = THEMES[nextIndex].id;
  setTheme(nextTheme, { transition: true });
  return nextTheme;
};
