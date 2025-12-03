export interface HotkeyConfig {
  moveUp: string;
  moveDown: string;
  enter: string;
  goBack: string;
}

export const defaultHotkeys: HotkeyConfig = {
  moveUp: 'ArrowUp',
  moveDown: 'ArrowDown',
  enter: 'z',
  goBack: 'x',
};

let currentHotkeys: HotkeyConfig = { ...defaultHotkeys };

export function getHotkeys(): HotkeyConfig {
  return { ...currentHotkeys };
}

export function setHotkeys(hotkeys: Partial<HotkeyConfig>): void {
  currentHotkeys = { ...currentHotkeys, ...hotkeys };
}

export function resetHotkeys(): void {
  currentHotkeys = { ...defaultHotkeys };
}

export function isHotkey(key: string, action: keyof HotkeyConfig): boolean {
  const hotkey = currentHotkeys[action];
  return key.toLowerCase() === hotkey.toLowerCase() || key === hotkey;
}

