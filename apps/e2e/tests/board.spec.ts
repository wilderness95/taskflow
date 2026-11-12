import { expect, test } from '@playwright/test'
import { createBoard, register } from './helpers'

test.describe('tábla és kártyák', () => {
  test('tábla, oszlop és kártya létrehozása, keresés', async ({ page }) => {
    await register(page, 'Olga')
    await createBoard(page, 'Sprint 1')

    await page.getByRole('button', { name: '+ Új oszlop' }).click()
    await page.getByRole('button', { name: '+ Kártya hozzáadása' }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Cím', { exact: true }).fill('Tejet venni')
    await dialog.getByRole('button', { name: 'Hozzáadás', exact: true }).click()
    await expect(page.getByText('Tejet venni')).toBeVisible()

    await page.getByRole('button', { name: '+ Kártya hozzáadása' }).first().click()
    await page.getByRole('dialog').getByLabel('Cím', { exact: true }).fill('Kenyeret sütni')
    await page.getByRole('dialog').getByRole('button', { name: 'Hozzáadás', exact: true }).click()
    await expect(page.getByText('Kenyeret sütni')).toBeVisible()

    await page.getByRole('textbox', { name: 'Keresés' }).fill('tej')
    await expect(page.getByText('Tejet venni')).toBeVisible()
    await expect(page.getByText('Kenyeret sütni')).toBeHidden()
  })

  test('a kártya a frissítés után is megmarad (perzisztencia)', async ({ page }) => {
    await register(page, 'Olga')
    await createBoard(page, 'Perzisztens')
    await page.getByRole('button', { name: '+ Új oszlop' }).click()
    await page.getByRole('button', { name: '+ Kártya hozzáadása' }).first().click()
    await page.getByRole('dialog').getByLabel('Cím', { exact: true }).fill('Megmarad')
    await page.getByRole('dialog').getByRole('button', { name: 'Hozzáadás', exact: true }).click()
    await expect(page.getByText('Megmarad')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Megmarad')).toBeVisible()
  })

  test('a mikrofon gomb rejtve marad, ha nincs Gemini API kulcs beállítva', async ({ page }) => {
    await register(page, 'Olga')
    await createBoard(page, 'Hang nélkül')
    await expect(page.getByRole('button', { name: 'Új oszlop', exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hangvezérlés indítása' })).toHaveCount(0)
  })
})
