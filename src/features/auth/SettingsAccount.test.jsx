import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SettingsSheet from '../SettingsSheet.jsx'
import { SettingsProvider } from '../yijing/SettingsContext.jsx'
import { AuthProvider } from './AuthContext.jsx'

describe('Settings account entry', () => {
  it('renders login and registration entry points for a web guest', () => {
    const html = renderToStaticMarkup(
      <SettingsProvider>
        <AuthProvider>
          <SettingsSheet open onClose={() => {}} />
        </AuthProvider>
      </SettingsProvider>,
    )
    expect(html).toContain('账号')
    expect(html).toContain('登录')
    expect(html).toContain('注册')
  })
})
