import { expect, test } from '@playwright/test'
import { PASSWORD, register, uniqueEmail } from './helpers'

test.describe('hitelesítés', () => {
  test('regisztráció, kijelentkezés és újra belépés', async ({ page }) => {
    const email = await register(page, 'Teszt Elek')

    await page.getByRole('button', { name: 'Felhasználói menü' }).click()
    await page.getByRole('button', { name: 'Kijelentkezés' }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel('E-mail-cím').fill(email)
    await page.getByLabel('Jelszó').fill(PASSWORD)
    await page.getByRole('button', { name: 'Belépés' }).click()
    await expect(page).toHaveURL(/\/w\//)
  })

  test('hibás jelszóval nem lehet belépni', async ({ page }) => {
    const email = await register(page, 'Teszt Elek')
    await page.getByRole('button', { name: 'Felhasználói menü' }).click()
    await page.getByRole('button', { name: 'Kijelentkezés' }).click()

    await page.getByLabel('E-mail-cím').fill(email)
    await page.getByLabel('Jelszó').fill('rossz-jelszo-123456')
    await page.getByRole('button', { name: 'Belépés' }).click()
    await expect(page.getByRole('alert')).toContainText('Hibás e-mail-cím vagy jelszó')
    await expect(page).toHaveURL(/\/login/)
  })

  test('bejelentkezés nélkül a védett oldal a belépésre irányít', async ({ page }) => {
    await page.goto('/settings/api-keys')
    await expect(page).toHaveURL(/\/login/)
  })

  test('ismétlődő e-mail-cím regisztrációja hibát ad', async ({ page, context }) => {
    const email = uniqueEmail('dup')
    await register(page, 'Első', email)
    await context.clearCookies()
    await page.goto('/register')
    await page.getByLabel('Név').fill('Második')
    await page.getByLabel('E-mail-cím').fill(email)
    await page.getByLabel('Jelszó').fill(PASSWORD)
    await page.getByRole('button', { name: 'Fiók létrehozása' }).click()
    await expect(page.getByRole('alert')).toContainText('már regisztráltak')
  })
})

test.describe('zárt regisztráció', () => {
  test('meghívó nélkül a „csak meghívóval” oldal jön, meghívó-hivatkozással az űrlap', async ({
    page,
  }) => {
    await page.route('**/api/v1/health', (route) =>
      route.fulfill({ json: { status: 'ok', voice: false, registrationOpen: false } }),
    )
    await page.goto('/login')
    await page.getByRole('link', { name: 'Regisztráció' }).click()
    await expect(page.getByRole('heading', { name: 'Regisztráció csak meghívással' })).toBeVisible()
    await expect(page.getByLabel('Jelszó')).toHaveCount(0)
    await page.getByRole('link', { name: 'Már van fiókod? Belépés' }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/register?invite=abc&email=meghivott%40example.com')
    await expect(page.getByLabel('Jelszó')).toBeVisible()
    await expect(page.getByLabel('E-mail-cím')).toHaveValue('meghivott@example.com')
  })
})
