import { expect, test } from '@playwright/test'
import { register } from './helpers'

test.describe('listák', () => {
  test('bevásárlólista: tételek, szakasz, ismétlődő visszaállítás, élő frissítés és archiválás', async ({
    page,
    playwright,
    baseURL,
  }) => {
    await register(page, 'Olga')
    // Gyors navigáció a felhasználói menüből: Listák, majd vissza a Táblákhoz és újra a Listákhoz.
    await page.getByRole('button', { name: 'Felhasználói menü' }).click()
    await page
      .getByRole('navigation', { name: 'Gyors navigáció' })
      .getByRole('button', { name: 'Listák' })
      .click()
    await expect(page).toHaveURL(/\/lists$/)
    await page.getByRole('button', { name: 'Felhasználói menü' }).click()
    await page
      .getByRole('navigation', { name: 'Gyors navigáció' })
      .getByRole('button', { name: 'Táblák' })
      .click()
    await expect(page).toHaveURL(/\/w\/[^/]+$/)
    await page.getByRole('link', { name: 'Listák' }).click()
    await page.getByRole('button', { name: '+ Új lista' }).click()
    await page.getByRole('dialog').getByLabel('A lista neve').fill('Hétvégi bevásárlás')
    await page.getByRole('dialog').getByRole('button', { name: 'Létrehozás' }).click()
    await expect(page).toHaveURL(/\/l\//)
    await expect(page.getByRole('heading', { name: 'Hétvégi bevásárlás' })).toBeVisible()

    // Szakasz és tételek Enterrel.
    await page.getByRole('button', { name: '+ Szakasz' }).click()
    await page.getByLabel('A szakasz neve').fill('Tejtermék')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Tejtermék' })).toBeVisible()

    const input = page.getByLabel('Új tétel', { exact: true })
    await page.getByRole('checkbox', { name: 'Ismétlődő', exact: true }).check()
    await input.fill('Kenyér')
    await input.press('Enter')
    await expect(page.getByText('Kenyér')).toBeVisible()
    await page.getByRole('checkbox', { name: 'Ismétlődő', exact: true }).uncheck()
    await input.fill('Só')
    await input.press('Enter')
    await expect(page.getByText('Só')).toBeVisible()

    // Kipipálás, majd a kipipáltak kezelése.
    await page.getByRole('checkbox', { name: /Kenyér/ }).click()
    await expect(page.getByRole('checkbox', { name: /Kenyér/ })).toBeChecked()
    await page.getByRole('checkbox', { name: /Só/ }).click()
    await expect(page.getByRole('checkbox', { name: /Só/ })).toBeChecked()
    await expect(page.getByText('2 / 2 kész')).toBeVisible()
    await page.getByRole('button', { name: 'Ismétlődők visszaállítása (1)' }).click()
    await expect(page.getByRole('checkbox', { name: /Kenyér/ })).not.toBeChecked()
    await page.getByRole('button', { name: 'Kipipáltak törlése (1)' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Megerősítés' }).click()
    await expect(page.getByText('Só')).toHaveCount(0)

    // Egy másik kliens (API kulcs) tétele élőben megjelenik az oldal újratöltése nélkül.
    const listId = page.url().split('/l/')[1]!
    const created = await page.request.post('/api/v1/api-keys', {
      data: { name: 'e2e lista', scopes: ['boards:read', 'boards:write'] },
    })
    const { key } = (await created.json()) as { key: string }
    const agent = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { authorization: `Bearer ${key}` },
    })
    const added = await agent.post(`/api/v1/lists/${listId}/items`, { data: { text: 'Tej' } })
    expect(added.status()).toBe(201)
    await expect(page.getByText('Tej', { exact: true })).toBeVisible()
    await agent.dispose()

    // Archiválás és visszaállítás.
    await page.getByRole('button', { name: 'Archiválás' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Archiválás' }).click()
    await expect(page).toHaveURL(/\/lists$/)
    await page.getByRole('button', { name: 'Hétvégi bevásárlás lista visszaállítása' }).click()
    await expect(page.getByRole('link', { name: /Hétvégi bevásárlás/ })).toBeVisible()
  })
})
