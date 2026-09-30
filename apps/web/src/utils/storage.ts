/**
 * Safe local storage utilities with try/catch guards (PRD 4.5).
 */

const SOURCE_STORAGE_KEY = 'javascope_editor_code';

export function loadSourceFromStorage(): string | null {
  try {
    return localStorage.getItem(SOURCE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveSourceToStorage(code: string): void {
  try {
    localStorage.setItem(SOURCE_STORAGE_KEY, code);
  } catch {
    // Ignore quota or disabled storage errors
  }
}
