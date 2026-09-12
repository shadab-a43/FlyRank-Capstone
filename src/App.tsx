import { useEffect, useState, type FormEvent } from 'react'

type Theme = 'light' | 'dark' | 'system'

const inputClassName =
  'mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-zinc-800 focus:ring-2 focus:ring-zinc-800/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200/20'

function applyTheme(theme: Theme) {
  const root = document.documentElement

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
    return
  }

  root.classList.toggle('dark', theme === 'dark')
}

function App() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [theme, setTheme] = useState<Theme>('system')
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavedMessage(`Saved settings for ${name || 'you'}.`)
  }

  return (
    <main className="min-h-svh bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Update your name, email, and color theme.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="theme" className="block text-sm font-medium">
              Theme
            </label>
            <select
              id="theme"
              name="theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
              className={inputClassName}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus:ring-zinc-100"
          >
            Save settings
          </button>

          {savedMessage ? (
            <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
              {savedMessage}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  )
}

export default App
