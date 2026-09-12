import { FormEvent, useEffect, useState } from 'react';
import { SettingsErrors, SettingsValues, resolveTheme, validateSettings } from './validation';
import './styles.css';

const initialValues: SettingsValues = {
  name: '',
  email: '',
  theme: 'system',
};

export default function App() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme() {
      document.documentElement.dataset.theme = resolveTheme(values.theme, mediaQuery.matches);
    }

    applyTheme();

    if (values.theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
    }

    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [values.theme]);

  function updateValue(field: keyof SettingsValues, value: string) {
    setValues((current) => ({ ...current, [field]: value } as SettingsValues));
    setSaved(false);

    if (field === 'name' || field === 'email') {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateSettings(values);
    setErrors(nextErrors);
    setSaved(Object.keys(nextErrors).length === 0);
  }

  return (
    <main className="page-shell">
      <section className="settings-panel" aria-labelledby="settings-title">
        <p className="eyebrow">Account preferences</p>
        <h1 id="settings-title">Settings</h1>
        <p className="intro">Keep your profile details and display preferences up to date.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={values.name}
              onChange={(event) => updateValue('name', event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              autoComplete="name"
            />
            {errors.name && <p id="name-error" className="error-message" role="alert">{errors.name}</p>}
          </div>

          <div className="field-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={values.email}
              onChange={(event) => updateValue('email', event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              autoComplete="email"
            />
            {errors.email && <p id="email-error" className="error-message" role="alert">{errors.email}</p>}
          </div>

          <div className="field-group">
            <label htmlFor="theme">Theme</label>
            <select
              id="theme"
              name="theme"
              value={values.theme}
              onChange={(event) => updateValue('theme', event.target.value)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <button type="submit">Save settings</button>
          {saved && <p className="success-message" role="status">Settings saved.</p>}
        </form>
      </section>
    </main>
  );
}