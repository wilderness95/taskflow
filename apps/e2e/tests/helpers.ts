import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'correct-horse-battery'

let counter = 0
/** Egyedi e-mail-cím tesztenként (a memória-adatbázis a futás végéig közös). */
export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${counter++}@example.com`

/** Új fiók regisztrálása a felületen; a végén a munkaterület oldalán vagyunk. */
export async function register(page: Page, name: string, email = uniqueEmail('user')) {
  await page.goto('/register')
  await page.getByLabel('Név').fill(name)
  await page.getByLabel('E-mail-cím').fill(email)
  await page.getByLabel('Jelszó').fill(PASSWORD)
  await page.getByRole('button', { name: 'Fiók létrehozása' }).click()
  await expect(page).toHaveURL(/\/w\//)
  return email
}

/** Új tábla a munkaterület oldalán; a végén a tábla oldalán vagyunk. */
export async function createBoard(page: Page, title: string) {
  await page.getByRole('button', { name: '+ Új tábla' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('A tábla címe').fill(title)
  await dialog.getByRole('button', { name: 'Létrehozás' }).click()
  await expect(page).toHaveURL(/\/b\//)
}
