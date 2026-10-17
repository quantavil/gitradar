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

  // Wait for rendering to start so the upper bound cannot pass on an empty list.
  await expect
    .poll(async () => (await screen.getByRole('article').all()).length)
    .toBeGreaterThan(0)

  await expect
    .poll(async () => (await screen.getByRole('article').all()).length)
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
  // The feed takes its scroll baseline on the first frame after mount, as it does for a real user.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  window.scrollTo(0, 400)
  window.dispatchEvent(new Event('scroll'))

  await expect.poll(() => onAutoSeen.mock.calls.length).toBeGreaterThan(0)
  const callsAfterScroll = onAutoSeen.mock.calls.length
  await new Promise((resolve) => setTimeout(resolve, 200))

  expect(onAutoSeen).toHaveBeenCalledTimes(callsAfterScroll)
  window.scrollTo(0, 0)
})
