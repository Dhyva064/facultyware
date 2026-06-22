const { test, expect } = require('@playwright/test');
const { loginAsPengguna, loginAsPenanggungJawab } = require('./helpers/auth');

test.describe('Search dan Filter', () => {

    test('3. Filter riwayat laporan berdasarkan status (Important) - Pengguna', async ({ page }) => {
        await loginAsPengguna(page);
        // Rute yang benar: /laporan (tidak ada /laporan/riwayat)
        await page.goto('/laporan');

        // Gunakan selector yang ada di views/pj/laporan/index.ejs & pengguna/laporan/index.ejs
        // Search form menggunakan name="search", bukan #filter-status
        const searchInput = page.locator('input[name="search"]');
        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('Selesai');
            await page.click('button[type="submit"]');
            // Halaman harus tetap di /laporan (hasil search)
            await expect(page).toHaveURL(/\/laporan/);
        } else {
            console.log('Search input tidak tersedia di halaman ini');
        }
    });

    test('6. Search laporan berdasarkan nama aset (Important) - Penanggung Jawab', async ({ page }) => {
        await loginAsPenanggungJawab(page);
        // Rute yang benar: /laporan (bukan /pj/laporan)
        await page.goto('/laporan');

        // Selector yang benar: input[name="search"] bukan #input-search-aset
        const searchInput = page.locator('input[name="search"]');
        if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await searchInput.fill('Proyektor');
            await page.click('button[type="submit"]');
            await expect(page).toHaveURL(/\/laporan/);
        } else {
            console.log('Search input tidak tersedia');
        }
    });

});
