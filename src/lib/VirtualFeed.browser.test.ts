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

test('renders items correctly and supports virtual scrolling', async () => {
  const repos = makeRepos(2000)
  const screen = await render(VirtualFeed, {
    props: {
      repos,
      focusedIndex: 0,
      onFocusIndex: () => {},
      onDismiss: () => {},
    },
  })

  const firstRepoArticle = screen.getByRole('article', { name: /owner\/repo-0 repository/i })
  await expect.element(firstRepoArticle).toBeInTheDocument()
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

test('defers container resize updates until the next animation frame', async () => {
  class FakeResizeObserver {
    static instances: FakeResizeObserver[] = []
    observed: Element | null = null

    constructor(readonly callback: ResizeObserverCallback) {
      FakeResizeObserver.instances.push(this)
    }

    observe(element: Element) {
      this.observed = element
    }

    unobserve() {}

    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  const requestFrame = vi.spyOn(window, 'requestAnimationFrame')
  let shouldDefer = false

  try {
    const screen = await render(VirtualFeed, {
      props: {
        repos: makeRepos(20),
        focusedIndex: -1,
        onFocusIndex: () => {},
        onDismiss: () => {},
      },
    })

    await expect
      .element(screen.getByRole('article').first())
      .toBeInTheDocument()

    const containerObserver = FakeResizeObserver.instances.find((observer) =>
      observer.observed?.querySelector('[data-repo-key]'),
    )
    expect(containerObserver).toBeDefined()

    const before = requestFrame.mock.calls.length
    containerObserver?.callback([], containerObserver as unknown as ResizeObserver)
    shouldDefer = requestFrame.mock.calls.length > before
  } finally {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }

  expect(shouldDefer).toBe(true)
})
