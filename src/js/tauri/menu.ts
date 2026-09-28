/**
 * Tauri native menu events listener
 */
import { isTauri } from './file-ops.js';
import { setTheme, ThemeId } from '../utils/theme.js';

type UnlistenFn = () => void;

export async function setupTauriMenu(): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};

  const safeListen = async <T>(
    eventName: string,
    handler: (event: { payload: T }) => void
  ): Promise<UnlistenFn> => {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen<T>(eventName, handler);
    } catch {
      const w = window as unknown as {
        __TAURI__?: {
          event?: {
            listen: <P>(name: string, cb: (e: { payload: P }) => void) => Promise<UnlistenFn>;
          };
        };
      };
      if (w.__TAURI__?.event?.listen) {
        return await w.__TAURI__.event.listen<T>(eventName, handler);
      }
      return () => {};
    }
  };

  const unlistenTheme = await safeListen<string>('menu:set-theme', (event) => {
    if (event.payload) {
      setTheme(event.payload as ThemeId, { transition: true });
    }
  });

  return () => {
    unlistenTheme();
  };
}
