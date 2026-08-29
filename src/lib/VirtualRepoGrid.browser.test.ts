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

  await expect
    .poll(async () => {
      const links = await screen.getByRole('link').all()
      return links.length
    })
    .toBeLessThanOrEqual(40)
})
