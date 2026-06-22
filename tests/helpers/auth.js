// Helper login untuk berbagai role
async function loginAsPengguna(page) {
    await page.goto('/login');
    await page.fill('#username', 'pengguna1@ftiunand.ac.id');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/laporan');
}

async function loginAsPenanggungJawab(page) {
    await page.goto('/login');
    await page.fill('#username', 'pj@ftiunand.ac.id');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/home');
}

async function loginAsPengelolaAset(page) {
    await page.goto('/login');
    await page.fill('#username', 'pengelola@ftiunand.ac.id');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/penugasan');
}

module.exports = {
    loginAsPengguna,
    loginAsPenanggungJawab,
    loginAsPengelolaAset
};
