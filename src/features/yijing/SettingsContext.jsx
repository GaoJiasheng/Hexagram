import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSettings, saveSettings } from './storage.js'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettingsState] = useState(getSettings)

  const setSettings = useCallback((patch) => {
    setSettingsState(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  // 主题应用
  useEffect(() => {
    const { theme } = settings
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme', 'light')
    else if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [settings.theme])

  // 字号应用
  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', settings.fontScale)
  }, [settings.fontScale])

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
