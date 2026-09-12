export type SettingsValues = {
  name: string;
  email: string;
  theme: 'light' | 'dark' | 'system';
};

export type SettingsErrors = Partial<Record<'name' | 'email', string>>;

export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(theme: SettingsValues['theme'], prefersDark: boolean): ResolvedTheme {
  if (theme === 'system') {
    return prefersDark ? 'dark' : 'light';
  }

  return theme;
}

export function validateSettings(values: SettingsValues): SettingsErrors {
  const errors: SettingsErrors = {};

  if (!values.name.trim()) {
    errors.name = 'Name is required.';
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Enter a valid email address.';
  }

  return errors;
}