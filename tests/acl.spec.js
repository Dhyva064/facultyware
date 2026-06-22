const { test, expect } = require('@playwright/test');
const { loginAsPengguna, loginAsPengelolaAset } = require('./helpers/auth');

test.describe('Access Control List (ACL)', () => {
    test('Pengguna tidak bisa akses halaman PJ (Critical)', async ({ page }) => {
        await loginAsPengguna(page);
        
        // Mencoba akses halaman PJ
        await page.goto('/pj/laporan');
        
        // Assertions: redirect ke /home
        await expect(page).toHaveURL(/\/home/); 
    });

    test('Pengelola Aset tidak bisa akses laporan Pengguna (Critical)', async ({ page }) => {
        await loginAsPengelolaAset(page);
        
        // Mencoba akses halaman Laporan milik pengguna
        await page.goto('/laporan/buat');
        
        // Assertions: redirect ke /home
        await expect(page).toHaveURL(/\/home/);
    });
});
