export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  danger: string;
  inputBackground: string;
  keypadBackground: string;
  keypadKey: string;
  keypadKeyPressed: string;
  keypadSpecial: string;
  keypadSearch: string;
  photoPlaceholder: string;
  chipText: string;
  noteText: string;
  addButton: string;
  headerLink: string;
  statusBar: 'light' | 'dark';
}

export const lightColors: ThemeColors = {
  background: '#ffffff',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#101828',
  textSecondary: '#667085',
  textMuted: '#98a2b3',
  border: '#d0d5dd',
  borderSubtle: '#eaecf0',
  primary: '#1677ff',
  primaryText: '#ffffff',
  primarySoft: '#eef2ff',
  danger: '#d4380d',
  inputBackground: '#ffffff',
  keypadBackground: '#eef0f3',
  keypadKey: '#ffffff',
  keypadKeyPressed: '#dce1e8',
  keypadSpecial: '#e4e7ec',
  keypadSearch: '#1677ff',
  photoPlaceholder: '#f0f2f5',
  chipText: '#344054',
  noteText: '#344054',
  addButton: '#344054',
  headerLink: '#1677ff',
  statusBar: 'dark',
};

export const darkColors: ThemeColors = {
  background: '#0f1419',
  surface: '#1a2332',
  card: '#1a2332',
  text: '#f5f7fa',
  textSecondary: '#b8c0cc',
  textMuted: '#7b8694',
  border: '#2d3a4d',
  borderSubtle: '#2d3a4d',
  primary: '#3d8eff',
  primaryText: '#ffffff',
  primarySoft: '#1a2f4d',
  danger: '#ff6b4a',
  inputBackground: '#1a2332',
  keypadBackground: '#0b1016',
  keypadKey: '#243044',
  keypadKeyPressed: '#33455c',
  keypadSpecial: '#1e2a3a',
  keypadSearch: '#3d8eff',
  photoPlaceholder: '#243044',
  chipText: '#d0d5dd',
  noteText: '#d0d5dd',
  addButton: '#3d4f66',
  headerLink: '#5aa0ff',
  statusBar: 'light',
};

export const palettes: Record<ThemeMode, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};
