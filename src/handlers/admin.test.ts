import { Hono } from 'hono';
// Import the main application instance (named export)
import { app } from '../index';
import type { Env } from '../types';

// app is already correctly typed Hono<{ Bindings: Env }> due to its origin

describe('Admin Handler Tests', () => {
	const mockEnv = {
		ADMIN_TOKEN: 'test-secret-token',
		POST_INDEX: {
			idFromName: () => ({ toString: () => 'mock-id' } as any),
			get: () => ({ fetch: async () => new Response(JSON.stringify([])) } as any),
		},
		POST_STORAGE: {
			idFromString: () => ({ toString: () => 'mock-id' } as any),
			get: () => ({ fetch: async () => new Response(JSON.stringify({})) } as any),
		},
		BLOG_RULES: {
			list: async () => ({ keys: [] }),
			put: async () => {},
			delete: async () => {},
			get: async () => null,
		},
		// Add other necessary mocks for Env
	} as Env;

	beforeEach(() => {
		// Bind the mock environment to the context for each request
        // Hono's architecture means middleware in index.ts will handle this if app is the real instance
        // For testing, we ensure 'c.env' is available for handlers if they access it directly.
        // However, the bearerAuth in index.ts will use c.env.ADMIN_TOKEN.
        // We need to ensure that our test runner provides this 'env' to Hono's context.
        // Vitest/Hono typically handles this by passing env to `app.request`.
        // The structure below assumes `app.request` will make `mockEnv` available.
	});

	// --- Test /api/admin/login ---
	describe('POST /api/admin/login', () => {
		it('should login successfully with a correct token', async () => {
			const res = await app.request(
				'/api/admin/login',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: 'test-secret-token' }),
				},
				mockEnv
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(body.message).toBe('Login successful');
		});

		it('should fail login with an incorrect token', async () => {
			const res = await app.request(
				'/api/admin/login',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token: 'wrong-token' }),
				},
				mockEnv
			);
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.success).toBe(false);
			expect(body.message).toBe('Invalid token');
		});

		it('should fail login with no token in body', async () => {
			const res = await app.request(
				'/api/admin/login',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({}),
				},
				mockEnv
			);
			expect(res.status).toBe(401); // or 400 depending on implementation
			const body = await res.json();
			expect(body.success).toBe(false);
		});

        it('should fail login with malformed JSON body', async () => {
			const res = await app.request(
				'/api/admin/login',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: 'not-json',
				},
				mockEnv
			);
			expect(res.status).toBe(400);
			const body = await res.json();
			expect(body.success).toBe(false);
            expect(body.message).toBe('Invalid request body');
		});
	});

	// --- Test a protected route, e.g., /api/admin/posts ---
	describe('GET /api/admin/posts (Protected Route)', () => {
		it('should access successfully with a correct Bearer token', async () => {
			const res = await app.request(
				'/api/admin/posts',
				{
					headers: { Authorization: `Bearer test-secret-token` },
				},
				mockEnv
			);
			expect(res.status).toBe(200);
			// Further checks on the body can be added if needed
			// For example, expect(await res.json()).toEqual([]);
		});

		it('should fail with an incorrect Bearer token', async () => {
			const res = await app.request(
				'/api/admin/posts',
				{
					headers: { Authorization: `Bearer wrong-token` },
				},
				mockEnv
			);
			expect(res.status).toBe(401); // Unauthorized
            const text = await res.text();
            expect(text).toContain("Unauthorized"); // Hono's default bearer auth response
		});

		it('should fail with no Authorization header', async () => {
			const res = await app.request('/api/admin/posts', undefined, mockEnv);
			expect(res.status).toBe(401); // Unauthorized
            const text = await res.text();
            expect(text).toContain("Unauthorized");
		});

        it('should fail with malformed Authorization header', async () => {
			const res = await app.request(
				'/api/admin/posts',
				{
					headers: { Authorization: `Basic some-credentials` }, // Wrong scheme
				},
				mockEnv
			);
			expect(res.status).toBe(400); // Hono bearerAuth middleware returns 400 for malformed Authorization header
            const text = await res.text();
            expect(text).toContain("Bad Request"); // Or a more specific message if bearerAuth handles it
		});
	});
});
