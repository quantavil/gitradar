import { expect, test } from 'vitest'
import { render } from 'vitest-browser-svelte'
import VirtualRepoGrid from './VirtualRepoGrid.svelte'
import { makeRepos } from '../test/fixtures'

test('virtualizes large collections and keeps DOM bounded', async () => {
  const items = makeRepos(2000).map((repo) => ({
    key: repo.full_name,
    repo,
  }))

  const screen = await render(VirtualRepoGrid, {
    props: {
      items,
    },
  })

  // Wait for rendering to start so the upper bound cannot pass on an empty grid.
  await expect
    .poll(async () => (await screen.getByRole('link').all()).length)
    .toBeGreaterThan(0)

  await expect
    .poll(async () => (await screen.getByRole('link').all()).length)
    .toBeLessThanOrEqual(40)
})
