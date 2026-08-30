import { describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import App from '../App.svelte'
import { makeRepo } from '../test/fixtures'

describe('App integration', () => {
  test('shows the current repository source and live remaining count inline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/daily/')) {
          return new Response(JSON.stringify([makeRepo(0), makeRepo(1)]), {
            status: 200,
          })
        }
        if (url.includes('/weekly/')) {
          return new Response(JSON.stringify([makeRepo(2)]), { status: 200 })
        }
        return new Response(JSON.stringify([]), { status: 200 })
      }),
    )

    await render(App)

    await expect
      .poll(async () => {
        const text = document.body.textContent || ''
        return text.includes('Source:') && text.includes('Remaining 3 / 3')
      })
      .toBe(true)

    const text = document.body.textContent || ''
    expect(text).toMatch(/Source:\s*Daily/)
    expect(text).not.toContain('Daily + Weekly + Monthly')
    expect(text).toMatch(/Remaining\s+3\s+\/\s+3/)
  })

  test('Shift+? opens settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify([makeRepo(0)]), { status: 200 })
      }),
    )

    await render(App)

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '?',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )

    await expect
      .poll(async () => {
        const text = document.body.textContent || ''
        return text.includes('Settings & Shortcuts')
      })
      .toBe(true)
  })

  test('Navbar semantic navigation landmark and aria-current', async () => {
    const screen = await render(App)
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    await expect.element(nav).toBeInTheDocument()

    const savedBtn = screen.getByRole('button', { name: /Saved Bookmarks View/i })
    expect(savedBtn.element().getAttribute('aria-current')).toBeNull()

    await savedBtn.click()
    expect(savedBtn.element().getAttribute('aria-current')).toBe('page')
  })
})
