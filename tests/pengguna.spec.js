const { test, expect } = require('@playwright/test');
const { loginAsPengguna } = require('./helpers/auth');

test.describe('Fitur Pengguna', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsPengguna(page);
    });

    test('1. Pengguna dapat membuat laporan kerusakan aset (Critical)', async ({ page }) => {
        await page.goto('/laporan/buat');
        
        await page.selectOption('#equipment_id', { index: 1 }); // Pilih equipment pertama
        await page.fill('#issue_description', 'AC tidak dingin dan bocor');
        await page.click('button[type="submit"]');
        
        // Assertions
        await expect(page).toHaveURL(/\/laporan/);
        // Cek muncul notif laporan baru atau status list
        await expect(page.locator('text=Laporan Kerusakan Aset').first()).toBeVisible();
    });

    test('2. Pengguna dapat melihat status laporan (Critical)', async ({ page }) => {
        await page.goto('/laporan');
        
        // Assertions
        // Cek status laporan
        await expect(page.locator('text=Dilaporkan').first()).toBeVisible(); 
    });
});
