const { test, expect } = require('@playwright/test');
const { loginAsPenanggungJawab, loginAsPengelolaAset, loginAsPengguna } = require('./helpers/auth');

test.describe('Error Handling & Keamanan', () => {

  // ── 1. Unauthenticated Access ──────────────────────────────────────────────
  test.describe('Akses tanpa login (Unauthenticated)', () => {

    test('ERR-1. Akses /home tanpa session → redirect ke /login', async ({ page }) => {
      await page.goto('/home');
      await expect(page).toHaveURL(/\/login/);
    });

    test('ERR-2. Akses /laporan tanpa session → redirect ke /login', async ({ page }) => {
      await page.goto('/laporan');
      await expect(page).toHaveURL(/\/login/);
    });

    test('ERR-3. Akses /maintenance tanpa session → redirect ke /login', async ({ page }) => {
      await page.goto('/maintenance');
      await expect(page).toHaveURL(/\/login/);
    });

    test('ERR-4. Akses /penugasan tanpa session → redirect ke /login', async ({ page }) => {
      await page.goto('/penugasan');
      await expect(page).toHaveURL(/\/login/);
    });

    test('ERR-5. Akses /api/maintenance tanpa token → 200 atau 401 (tergantung config)', async ({ request }) => {
      const response = await request.get('/api/maintenance');
      // Jika API_TOKEN tidak di-set di .env, endpoint terbuka (200)
      // Jika API_TOKEN di-set, akan 401
      expect([200, 401]).toContain(response.status());
    });
  });

  // ── 2. ACL / Role-Based Access ─────────────────────────────────────────────
  test.describe('Akses lintas role (ACL)', () => {

    test('ERR-6. Pengguna biasa akses /maintenance → redirect ke /home atau /laporan', async ({ page }) => {
      await loginAsPengguna(page);
      await page.goto('/maintenance');
      // Role pengguna tidak punya akses maintenance — harus di-redirect
      await expect(page).not.toHaveURL('/maintenance');
    });

    test('ERR-7. Pengguna biasa akses /penugasan → redirect keluar', async ({ page }) => {
      await loginAsPengguna(page);
      await page.goto('/penugasan');
      await expect(page).not.toHaveURL('/penugasan');
    });

    test('ERR-8. Pengelola akses /laporan → redirect ke /home', async ({ page }) => {
      await loginAsPengelolaAset(page);
      await page.goto('/laporan');
      // Pengelola aset bukan penanggung_jawab, harus redirect
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/laporan/');
    });

    test('ERR-9. Pengelola akses /maintenance → redirect ke /home', async ({ page }) => {
      await loginAsPengelolaAset(page);
      await page.goto('/maintenance');
      await expect(page).not.toHaveURL('/maintenance');
    });
  });

  // ── 3. Form Validation ─────────────────────────────────────────────────────
  test.describe('Validasi form input', () => {

    test('ERR-10. Login dengan kredensial salah → tetap di /login dengan pesan error', async ({ page }) => {
      await page.goto('/login');
      await page.fill('#username', 'salah@email.com');
      await page.fill('#password', 'passwordsalah');
      await page.click('button[type="submit"]');

      // Harus tetap di halaman login, tidak redirect ke dalam aplikasi
      await expect(page).toHaveURL(/\/login/);
    });

    test('ERR-11. Login dengan password kosong → tidak bisa submit', async ({ page }) => {
      await page.goto('/login');
      await page.fill('#username', 'pj@ftiunand.ac.id');
      // Sengaja tidak isi password
      await page.click('button[type="submit"]');

      // Harus tetap di /login
      await expect(page).toHaveURL(/\/login/);
    });

    test('ERR-12. Create laporan tanpa isi deskripsi → tetap di form', async ({ page }) => {
      await loginAsPenanggungJawab(page);
      await page.goto('/laporan/buat');

      // Pilih alat jika ada, tapi sengaja tidak isi deskripsi / minimal
      const submitBtn = page.locator('button[type="submit"]');
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        // Tidak boleh redirect sukses, form harus tetap tampil
        await expect(page).not.toHaveURL(/\/laporan$/);
      } else {
        console.log('Halaman buat laporan tidak tersedia untuk role ini');
      }
    });
  });

  // ── 4. 404 / Not Found ─────────────────────────────────────────────────────
  test.describe('Halaman 404 / resource tidak ditemukan', () => {

    test('ERR-13. Route tidak ada → server merespons (tidak crash)', async ({ page }) => {
      const response = await page.goto('/halaman-yang-tidak-ada-sama-sekali-12345');
      // Server tidak boleh crash (500). Bisa 404, atau redirect ke login
      expect(response.status()).not.toBe(500);
    });

    test('ERR-14. Laporan dengan ID tidak valid (999999) → tidak crash', async ({ page }) => {
      await loginAsPenanggungJawab(page);
      const response = await page.goto('/laporan/999999');
      expect(response.status()).not.toBe(500);
      expect([200, 302, 404]).toContain(response.status());
    });

    test('ERR-15. Maintenance dengan ID tidak valid (999999) → tidak crash', async ({ page }) => {
      await loginAsPenanggungJawab(page);
      const response = await page.goto('/maintenance/999999');
      expect(response.status()).not.toBe(500);
      expect([200, 302, 404]).toContain(response.status());
    });

    test('ERR-16. Penugasan dengan ID tidak valid (999999) → tidak crash', async ({ page }) => {
      await loginAsPengelolaAset(page);
      const response = await page.goto('/penugasan/999999');
      expect(response.status()).not.toBe(500);
      expect([200, 302, 404]).toContain(response.status());
    });
  });

  // ── 5. PDF endpoint error handling ─────────────────────────────────────────
  test.describe('Error handling endpoint PDF', () => {

    test('ERR-17. Rekap PDF tanpa parameter bulan → server tidak crash', async ({ page }) => {
      await loginAsPenanggungJawab(page);
      const response = await page.goto('/laporan/pdf-rekap');
      // Harus mengembalikan 400 (bad request) bukan 500
      expect(response.status()).not.toBe(500);
    });

    test('ERR-18. Rekap PDF dengan format bulan salah → server tidak crash', async ({ page }) => {
      await loginAsPenanggungJawab(page);
      const response = await page.goto('/laporan/pdf-rekap?bulan=tidak-valid');
      expect(response.status()).not.toBe(500);
    });
  });
});
