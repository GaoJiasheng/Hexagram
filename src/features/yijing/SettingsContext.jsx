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

  // 跨标签同步:另一标签改了设置(主题/字号/译文),本标签随动,免后写覆盖与界面不一致
  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'guanxiang.v1.settings') setSettingsState(getSettings())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
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

  // 行宽应用(读经正文宽度;narrow/normal/wide → --read-w)
  useEffect(() => {
    const W = { narrow: '600px', normal: '680px', wide: '820px' }
    document.documentElement.style.setProperty('--read-w', W[settings.readWidth] || W.normal)
  }, [settings.readWidth])

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
