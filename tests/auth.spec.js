const { test, expect } = require('@playwright/test');

test.describe('Autentikasi', () => {
    test('Login valid (Critical)', async ({ page }) => {
        await page.goto('/login');
        await page.fill('#username', 'pengguna1@ftiunand.ac.id');
        await page.fill('#password', 'password123');
        await page.click('button[type="submit"]');
        
        // Assertions
        await expect(page).toHaveURL(/\/laporan/);
        await expect(page.locator('h1').first()).toContainText('Laporan Kerusakan Aset');
    });

    test('Login invalid credentials (Important)', async ({ page }) => {
        await page.goto('/login');
        await page.fill('#username', 'wrong_user@ftiunand.ac.id');
        await page.fill('#password', 'wrong_password');
        await page.click('button[type="submit"]');
        
        // Assertions
        await expect(page.locator('text=Email atau password tidak terdaftar')).toBeVisible();
    });

    test('Logout (Important)', async ({ page }) => {
        await page.goto('/login');
        await page.fill('#username', 'pengguna1@ftiunand.ac.id');
        await page.fill('#password', 'password123');
        await page.click('button[type="submit"]');
        
        await page.goto('/logout');
        
        // Assertions
        await expect(page).toHaveURL(/\/login/);
    });
});
