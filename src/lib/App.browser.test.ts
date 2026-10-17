import { afterEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import App from '../App.svelte'
import { makeRepo } from '../test/fixtures'
import { seenStore } from './seen.svelte'

describe('App integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('keeps an auto-seen card visible and greyed in the current feed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify(Array.from({ length: 10 }, (_, i) => makeRepo(i))), {
          status: 200,
        })
      }),
    )

    await seenStore.init()
    await seenStore.resetSeen()
    seenStore.autoSeenOnScroll = true

    const screen = await render(App)
    const articleCount = async () =>
      (await screen
        .getByRole('article', { name: /owner\/repo-0 repository/i })
        .all()).length

    await expect.poll(articleCount).toBe(1)
    await expect
      .poll(async () => (document.body.textContent || '').includes('Remaining 10 / 10'))
      .toBe(true)
    await expect.poll(() => document.documentElement.scrollHeight).toBeGreaterThan(800)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    window.scrollTo(0, 180)
    window.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    // Scroll until repo 0's bottom edge sits above the sticky header. The masthead sets how far
    // the list starts, so derive the distance from the layout instead of a fixed offset.
    const firstCard = document.querySelector<HTMLElement>('[aria-label="owner/repo-0 repository"]')
    const firstCardBottom = (firstCard?.getBoundingClientRect().bottom ?? 0) + window.scrollY
    window.scrollTo(0, Math.max(firstCardBottom - 40, 180))
    window.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    await expect.poll(() => window.scrollY).toBeGreaterThan(0)
    await expect
      .poll(async () => (document.body.textContent || '').includes('Remaining 9 / 10'))
      .toBe(true)
    await expect.poll(articleCount).toBe(1)
    await expect
      .poll(
        () =>
          document.querySelector('[aria-label="owner/repo-0 repository"] > div')
            ?.className ?? '',
      )
      .toContain('opacity-60')

    await seenStore.resetSeen()
  })

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
})
