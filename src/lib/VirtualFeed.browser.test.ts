import { expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import VirtualFeed from './VirtualFeed.svelte'
import { makeRepos } from '../test/fixtures'

test('keeps the rendered card count bounded without pagination controls', async () => {
  const repos = makeRepos(2000)
  const screen = await render(VirtualFeed, {
    props: {
      repos,
      focusedIndex: -1,
      onFocusIndex: () => {},
      onDismiss: () => {},
    },
  })

  await expect
    .poll(async () => {
      const items = await screen.getByRole('article').all()
      return items.length
    })
    .toBeLessThanOrEqual(40)

  const buttons = await screen.getByRole('button', { name: /next page|load more/i }).all()
  expect(buttons).toHaveLength(0)
})

test('does not auto-see more rows without another scroll event', async () => {
  const onAutoSeen = vi.fn()
  const screen = await render(VirtualFeed, {
    props: {
      repos: makeRepos(100),
      focusedIndex: -1,
      onFocusIndex: () => {},
      onDismiss: () => {},
      onAutoSeen,
    },
  })

  await expect.element(screen.getByRole('article').first()).toBeInTheDocument()
  window.scrollTo(0, 400)
  window.dispatchEvent(new Event('scroll'))

  await expect.poll(() => onAutoSeen.mock.calls.length).toBeGreaterThan(0)
  const callsAfterScroll = onAutoSeen.mock.calls.length
  await new Promise((resolve) => setTimeout(resolve, 200))

  expect(onAutoSeen).toHaveBeenCalledTimes(callsAfterScroll)
  window.scrollTo(0, 0)
})
