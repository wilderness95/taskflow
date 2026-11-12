import { expect, test } from '@playwright/test'
import { PASSWORD, register, uniqueEmail } from './helpers'

// A közös memória-adatbázisban az első regisztrált felhasználó a platform-admin. A fájlok
// ábécésorrendben futnak, és az `admin.spec.ts` az első, ezért az itt regisztrált admin lesz.
test.describe('platform-adminisztráció', () => {
  test('az admin felfüggeszt és visszaállít egy felhasználót, meghívót küld; a sima felhasználó nem éri el', async ({
    page,
    browser,
  }) => {
    await register(page, 'Admin Anna')
    await page.getByRole('button', { name: 'Felhasználói menü' }).click()
    await page.getByRole('button', { name: 'Adminisztráció' }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Platform-adminisztráció' })).toBeVisible()

    // Egy másik, nem admin felhasználó külön böngészőkörnyezetben.
    const otherContext = await browser.newContext()
    const other = await otherContext.newPage()
    const email = uniqueEmail('bela')
    await register(other, 'Béla Teszt', email)
    await other.getByRole('button', { name: 'Felhasználói menü' }).click()
    await expect(other.getByRole('button', { name: 'Adminisztráció' })).toHaveCount(0)
    await other.goto('/admin')
    await expect(other).not.toHaveURL(/\/admin/)

    // Keresés és adatlap.
    await page.getByRole('link', { name: 'Felhasználók' }).click()
    await page.getByLabel('Keresés').fill('Béla')
    await page.getByRole('button', { name: 'Béla Teszt adatlapja' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(email)).toBeVisible()

    // Felfüggesztés megerősítéssel: Béla azonnal kijelentkezik, és nem tud belépni.
    await dialog.getByRole('button', { name: 'Felfüggesztés' }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: 'Felfüggesztés' }).click()
    await expect(page.getByText('A fiók felfüggesztve.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Visszaállítás' })).toBeVisible()

    await other.reload()
    await expect(other).toHaveURL(/\/login/)
    await other.getByLabel('E-mail-cím').fill(email)
    await other.getByLabel('Jelszó').fill(PASSWORD)
    await other.getByRole('button', { name: 'Belépés' }).click()
    await expect(other.getByRole('alert')).toContainText('fel van függesztve')

    // Visszaállítás után újra be tud lépni.
    await dialog.getByRole('button', { name: 'Visszaállítás' }).click()
    await expect(page.getByText('A fiók visszaállítva.')).toBeVisible()
    await other.getByRole('button', { name: 'Belépés' }).click()
    await expect(other).toHaveURL(/\/w\//)
    await otherContext.close()
    await dialog.getByRole('button', { name: 'Bezárás' }).click()

    // Meghívó küldése és visszavonása.
    await page.getByRole('link', { name: 'Meghívók' }).click()
    const invited = uniqueEmail('meghivott')
    await page.getByLabel('E-mail-cím').fill(invited)
    await page.getByRole('button', { name: 'Meghívó küldése' }).click()
    await expect(page.getByText('A meghívót elküldtük.')).toBeVisible()
    const row = page.getByRole('listitem').filter({ hasText: invited })
    await expect(row.getByText('Függő')).toBeVisible()
    await row.getByRole('button', { name: 'Visszavonás' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Visszavonás' }).click()
    await expect(row.getByText('Visszavonva')).toBeVisible()

    // Az auditnapló mindent rögzít.
    await page.getByRole('link', { name: 'Auditnapló' }).click()
    await expect(page.getByText(/felfüggesztette Béla Teszt fiókját/)).toBeVisible()
    await expect(page.getByText(/visszavonta a meghívót/)).toBeVisible()
  })
})
