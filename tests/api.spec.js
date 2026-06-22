const { test, expect } = require('@playwright/test');

test.describe('Pengujian API (READ-ONLY)', () => {
    test('1. GET /api/maintenance mengembalikan data JSON', async ({ request }) => {
        const response = await request.get('/api/maintenance');
        expect(response.ok()).toBeTruthy();
        
        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data)).toBeTruthy();
    });

    test('2. GET /api/maintenance/:id mengembalikan detail permohonan', async ({ request }) => {
        const response = await request.get('/api/maintenance/1');
        
        // Asumsikan data bisa ada atau tidak (404), yang penting bukan 500 error
        if (response.status() === 200) {
            const data = await response.json();
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('data');
            expect(data.data).toHaveProperty('id');
        } else {
            expect(response.status()).toBe(404);
            const data = await response.json();
            expect(data).toHaveProperty('success', false);
        }
    });

    test('3. GET /api/pengelola-aset/maintenance mengembalikan data JSON', async ({ request }) => {
        const response = await request.get('/api/pengelola-aset/maintenance');
        expect(response.ok()).toBeTruthy();
        
        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data)).toBeTruthy();
    });

    test('4. GET /api/pengelola-aset/maintenance/:id mengembalikan detail', async ({ request }) => {
        const response = await request.get('/api/pengelola-aset/maintenance/1');
        
        if (response.status() === 200) {
            const data = await response.json();
            expect(data).toHaveProperty('success', true);
            expect(data).toHaveProperty('data');
            expect(data.data).toHaveProperty('id');
        } else {
            expect(response.status()).toBe(404);
            const data = await response.json();
            expect(data).toHaveProperty('success', false);
        }
    });
});
