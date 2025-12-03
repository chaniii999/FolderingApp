export interface HotkeyConfig {
  moveUp: string;
  moveDown: string;
  enter: string;
  goBack: string;
  edit: string;
  save: string;
  cancel: string;
  toggleExplorer: string;
}

export const defaultHotkeys: HotkeyConfig = {
  moveUp: 'ArrowUp',
  moveDown: 'ArrowDown',
  enter: 'z',
  goBack: 'x',
  edit: 'i',
  save: 'Control+F5',
  cancel: 'Escape',
  toggleExplorer: 'b',
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

export function isHotkey(key: string, action: keyof HotkeyConfig, event?: KeyboardEvent): boolean {
  const hotkey = currentHotkeys[action];
  
  // 조합 키 처리 (예: Control+F5)
  if (hotkey.includes('+')) {
    const parts = hotkey.split('+').map(p => p.trim());
    const keyPart = parts[parts.length - 1].toLowerCase();
    const modifiers = parts.slice(0, -1);
    
    if (event) {
      const keyMatches = key.toLowerCase() === keyPart || key === keyPart;
      const ctrlMatches = modifiers.includes('Control') ? event.ctrlKey : !event.ctrlKey;
      const altMatches = modifiers.includes('Alt') ? event.altKey : !event.altKey;
      const shiftMatches = modifiers.includes('Shift') ? event.shiftKey : !event.shiftKey;
      const metaMatches = modifiers.includes('Meta') ? event.metaKey : !event.metaKey;
      
      return keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches;
    }
    
    return false;
  }
  
  return key.toLowerCase() === hotkey.toLowerCase() || key === hotkey;
}

