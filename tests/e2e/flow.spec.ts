/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';

// Volledige flow op een iPhone-formaat, in de lokale testmodus (zie playwright.config.ts).

async function login(page: Page, email = 'bjorn@e2e.test') {
  await page.goto('/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill('dev-password');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByRole('heading', { name: 'Ons Netwerk' })).toBeVisible();
}

async function addPerson(page: Page, name: string, category: string) {
  await page.goto('/personen/nieuw');
  await page.getByPlaceholder('Voornaam').fill(name);
  await page.getByRole('button', { name: category, exact: true }).click();
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('persoon toevoegen, op de kaart, moment koppelen, persoonlijke tijdlijn', async ({ page }) => {
  await login(page);
  await addPerson(page, 'Thomas', 'Goede vrienden');
  await addPerson(page, 'Lisa', 'Familie');

  await page.goto('/netwerk');
  await expect(page.getByRole('button', { name: /^Thomas, Goede vrienden/ })).toBeVisible();
  await page.getByRole('button', { name: /^Lisa, Familie/ }).click();
  await expect(page.getByRole('heading', { name: 'Lisa' })).toBeVisible();

  await page.goto('/story/nieuw');
  await page.getByPlaceholder('Bv. Eerste ontmoeting met Thomas').fill('Weekend aan zee');
  await page.getByLabel('Zoek een persoon').fill('Tho');
  await page.getByRole('button', { name: /Thomas/ }).last().click();
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await expect(page.getByRole('heading', { name: 'Weekend aan zee' })).toBeVisible();

  await page.goto('/personen');
  await page.getByRole('link', { name: /Thomas/ }).click();
  await expect(page.getByText('Weekend aan zee')).toBeVisible();
  await page.goto('/story');
  await expect(page.getByText('Weekend aan zee')).toBeVisible();
});

test('offline: app opent, data blijft zichtbaar, wijzigingen wachten en synchroniseren later', async ({ page, context }) => {
  await login(page, 'offline@e2e.test');
  await addPerson(page, 'Kim', 'Kennissen');
  // wachten tot de service worker de app-shell beheert
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.ready).active);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Kim' })).toBeVisible();

  await context.setOffline(true);
  await page.goto('/personen');
  await expect(page.getByRole('link', { name: /Kim/ })).toBeVisible();
  await addPerson(page, 'Offline Olivia', 'Kennissen');
  await page.goto('/instellingen/sync');
  await expect(page.getByText(/lokaal opgeslagen/).locator('visible=true').first()).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('Alles is verstuurd.')).toBeVisible({ timeout: 15_000 });
});

test('een niet-uitgenodigde gebruiker krijgt geen toegang', async ({ page }) => {
  await login(page, 'eerste@e2e.test');
  await page.evaluate(() => localStorage.removeItem('ournetwork-local-auth'));
  await page.goto('/login');
  await page.locator('input[type=email]').fill('vreemde@e2e.test');
  await page.locator('input[type=password]').fill('dev-password');
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByText('Geen toegang')).toBeVisible();
});

// Klein maar geldig PNG-bestand (8×8, goud) om een foto te uploaden.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGPYsJsBK2IYlRBEAgDx3ivfUPzyeQAAAABJRU5ErkJggg==',
  'base64',
);

test('koppel, moment met foto, verwijderen en ongedaan maken, waarschuwing bij verlaten', async ({ page }) => {
  await login(page, 'koppel@e2e.test');
  await addPerson(page, 'Anna', 'Familie');
  await addPerson(page, 'Marc', 'Familie');

  // Relatie: Anna en Marc zijn partners → op de kaart verbonden met een partnerlijn.
  await page.goto('/netwerk');
  await page.getByRole('button', { name: 'Toevoegen' }).last().click();
  await page.getByRole('button', { name: /Nieuwe relatie/ }).click();
  const zoek = page.getByLabel('Zoek een persoon');
  await zoek.first().fill('Anna');
  await page.getByRole('dialog').getByRole('button', { name: /Anna/ }).first().click();
  await zoek.last().fill('Marc');
  await page.getByRole('dialog').getByRole('button', { name: /Marc/ }).last().click();
  await page.getByRole('radio', { name: 'Partner' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Opslaan' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Relatie bewaard' })).toBeVisible();
  await expect(page.locator('line[stroke="var(--champ)"]')).toHaveCount(1);

  // Moment met foto → foto op de pagina van het moment en in Our Story.
  await page.goto('/story/nieuw');
  await page.getByPlaceholder('Bv. Eerste ontmoeting met Thomas').fill('Trouwfeest');
  await page.locator('input[type=file]').setInputFiles({ name: 'feest.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Opslaan' }).click();
  await expect(page.getByRole('heading', { name: 'Trouwfeest' })).toBeVisible();
  await expect(page.locator('main img').first()).toBeVisible();

  // Verwijderen en meteen ongedaan maken.
  await page.getByRole('button', { name: /Verwijderen/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Verwijderen' }).click();
  await expect(page).toHaveURL(/\/story$/);
  await page.getByRole('button', { name: 'Ongedaan maken' }).click();
  await expect(page.getByText('Trouwfeest')).toBeVisible();

  // Onbewaarde wijzigingen: Annuleren vraagt eerst bevestiging.
  await page.goto('/personen/nieuw');
  await page.getByPlaceholder('Voornaam').fill('Half ingevuld');
  await page.getByRole('button', { name: 'Annuleren' }).click();
  await expect(page.getByRole('heading', { name: 'Wijzigingen niet bewaren?' })).toBeVisible();
});
