import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SettingsSheet from '../SettingsSheet.jsx'
import { SettingsProvider } from '../yijing/SettingsContext.jsx'
import { AuthProvider } from './AuthContext.jsx'

describe('Settings account entry', () => {
  it('renders login and registration entry points for a web guest', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SettingsProvider>
          <AuthProvider>
            <SettingsSheet open onClose={() => {}} />
          </AuthProvider>
        </SettingsProvider>
      </MemoryRouter>,
    )
    expect(html).toContain('账号')
    expect(html).toContain('登录')
    expect(html).toContain('注册')
  })
})
