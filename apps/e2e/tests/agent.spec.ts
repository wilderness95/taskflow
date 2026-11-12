import { expect, test } from '@playwright/test'
import { createBoard, register } from './helpers'

test.describe('AI agent hozzáférés (API kulcs)', () => {
  test('a kulccsal létrehozott kártya élőben megjelenik a nyitott táblán (SSE)', async ({
    page,
    playwright,
    baseURL,
  }) => {
    await register(page, 'Olga')
    await createBoard(page, 'Agent tábla')
    await page.getByRole('button', { name: '+ Új oszlop' }).click()
    await expect(page.getByRole('button', { name: '+ Kártya hozzáadása' })).toBeVisible()

    // Kulcs a bejelentkezett munkamenettel (a böngésző kontextusa közös a page.request-tel).
    const boardId = page.url().split('/b/')[1]!
    const created = await page.request.post('/api/v1/api-keys', {
      data: { name: 'e2e agent', scopes: ['boards:write'] },
    })
    expect(created.status()).toBe(201)
    const { key } = (await created.json()) as { key: string }

    // Új, cookie nélküli kliens: csak a Bearer kulcs azonosítja.
    const agent = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { authorization: `Bearer ${key}` },
    })
    const snapshot = await (await agent.get(`/api/v1/boards/${boardId}/snapshot`)).json()
    const columnId = snapshot.columns[0].id as string
    const card = await agent.post(`/api/v1/columns/${columnId}/cards`, {
      data: { title: 'Agent kártya' },
      headers: { 'idempotency-key': 'e2e-agent-card-1' },
    })
    expect(card.status()).toBe(201)

    // Az oldal újratöltése nélkül megjelenik.
    await expect(page.getByText('Agent kártya')).toBeVisible()

    // Ugyanazzal az Idempotency-Key-jel nem jön létre második kártya.
    const replay = await agent.post(`/api/v1/columns/${columnId}/cards`, {
      data: { title: 'Agent kártya' },
      headers: { 'idempotency-key': 'e2e-agent-card-1' },
    })
    expect(replay.headers()['idempotent-replayed']).toBe('true')
    await expect(page.getByText('Agent kártya')).toHaveCount(1)

    // A kulcs nem érhet el fiókkezelő végpontot.
    expect((await agent.get('/api/v1/api-keys')).status()).toBe(403)
    await agent.dispose()
  })
})
