import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initTheme,
  setTheme,
  getStoredTheme,
  getCurrentTheme,
  getAvailableThemes,
  cycleTheme,
} from '../js/utils/theme';

describe('Theme Manager Module', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    vi.useRealTimers();
  });

  it('should return available themes list', () => {
    const themes = getAvailableThemes();
    expect(themes).toHaveLength(6);
    const ids = themes.map((t) => t.id);
    expect(ids).toEqual([
      'classic-dark',
      'tokyo-newsprint',
      'swiss-typographic',
      'urushi-lacquer',
      'gruvbox-heritage',
      'nordic-fjord',
    ]);
  });

  it('should get default theme classic-dark when no storage exists', () => {
    expect(getStoredTheme()).toBe('classic-dark');
  });

  it('should set theme and update html attributes, classes, and storage', () => {
    setTheme('tokyo-newsprint');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'tokyo-newsprint'
    );
    expect(
      document.documentElement.classList.contains('theme-tokyo-newsprint')
    ).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('bentopdf-theme')).toBe('tokyo-newsprint');
    expect(getCurrentTheme()).toBe('tokyo-newsprint');
  });

  it('should handle dark mode class correctly', () => {
    setTheme('urushi-lacquer');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(
      document.documentElement.classList.contains('theme-urushi-lacquer')
    ).toBe(true);
  });

  it('should trigger themechange event with themeInfo detail', () => {
    const listener = vi.fn();
    window.addEventListener('themechange', listener);

    setTheme('swiss-typographic');

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.themeId).toBe('swiss-typographic');
    expect(event.detail.themeInfo.mode).toBe('light');

    window.removeEventListener('themechange', listener);
  });

  it('should cycle through available themes', () => {
    setTheme('classic-dark');
    const next1 = cycleTheme();
    expect(next1).toBe('tokyo-newsprint');
    const next2 = cycleTheme();
    expect(next2).toBe('swiss-typographic');
  });

  it('should handle transition class timeout', () => {
    vi.useFakeTimers();
    setTheme('nordic-fjord', { transition: true });
    expect(
      document.documentElement.classList.contains('theme-transitioning')
    ).toBe(true);

    vi.advanceTimersByTime(300);
    expect(
      document.documentElement.classList.contains('theme-transitioning')
    ).toBe(false);
  });

  it('should initialize theme on initTheme()', () => {
    localStorage.setItem('bentopdf-theme', 'gruvbox-heritage');
    initTheme();
    expect(getCurrentTheme()).toBe('gruvbox-heritage');
    expect(
      document.documentElement.classList.contains('theme-gruvbox-heritage')
    ).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
