import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SettingsProvider } from '../yijing/SettingsContext.jsx'

vi.mock('./AuthContext.jsx', () => ({
  useAuth: () => ({
    user: {
      id: 'reader-1',
      displayName: '测试读者',
      email: 'reader@example.com',
      avatarSeed: 'seed-1',
    },
    loading: false,
    enabled: true,
    openAuth: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('./sync.js', () => ({ syncNow: vi.fn() }))

const { default: SettingsSheet } = await import('../SettingsSheet.jsx')

describe('Settings cloud sync status', () => {
  it('shows status and the manual sync action only for a signed-in account', () => {
    const html = renderToStaticMarkup(
      <SettingsProvider>
        <SettingsSheet open onClose={() => {}} />
      </SettingsProvider>,
    )
    expect(html).toContain('云同步')
    expect(html).toContain('尚未同步过')
    expect(html).toContain('立即同步')
  })
})
