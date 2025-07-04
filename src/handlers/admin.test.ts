import { Hono } from 'hono';
import adminRoutes from './admin'; // Assuming admin.ts exports the Hono app instance
import type { Env } from '../types';

describe('Admin Handler Tests', () => {
	let app: Hono<{ Bindings: Env }>;
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
		// Add other necessary mocks for Env if admin routes use them directly
	} as Env;

	beforeEach(() => {
		// Re-initialize app before each test to ensure clean state
		// Pass the mock Env to the Hono app constructor if it expects it
		// For this example, adminRoutes is an instance, so we bind env to context
		app = new Hono<{ Bindings: Env }>();
		app.use('*', (c, next) => {
			c.env = mockEnv;
			return next();
		});
		app.route('/api/admin', adminRoutes); // Mount the admin routes
	});

	// --- Test /api/admin/login ---
	describe('POST /api/admin/login', () => {
		it('should login successfully with a correct token', async () => {
			const res = await app.request('/api/admin/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: 'test-secret-token' }),
			});
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.success).toBe(true);
			expect(body.message).toBe('Login successful');
		});

		it('should fail login with an incorrect token', async () => {
			const res = await app.request('/api/admin/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: 'wrong-token' }),
			});
			expect(res.status).toBe(401);
			const body = await res.json();
			expect(body.success).toBe(false);
			expect(body.message).toBe('Invalid token');
		});

		it('should fail login with no token in body', async () => {
			const res = await app.request('/api/admin/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});
			expect(res.status).toBe(401); // or 400 depending on implementation
			const body = await res.json();
			expect(body.success).toBe(false);
		});

        it('should fail login with malformed JSON body', async () => {
			const res = await app.request('/api/admin/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'not-json',
			});
			expect(res.status).toBe(400);
			const body = await res.json();
			expect(body.success).toBe(false);
            expect(body.message).toBe('Invalid request body');
		});
	});

	// --- Test a protected route, e.g., /api/admin/posts ---
	describe('GET /api/admin/posts (Protected Route)', () => {
		it('should access successfully with a correct Bearer token', async () => {
			const res = await app.request('/api/admin/posts', {
				headers: { Authorization: `Bearer test-secret-token` },
			});
			expect(res.status).toBe(200);
			// Further checks on the body can be added if needed
			// For example, expect(await res.json()).toEqual([]);
		});

		it('should fail with an incorrect Bearer token', async () => {
			const res = await app.request('/api/admin/posts', {
				headers: { Authorization: `Bearer wrong-token` },
			});
			expect(res.status).toBe(401); // Unauthorized
            const text = await res.text();
            expect(text).toContain("Unauthorized"); // Hono's default bearer auth response
		});

		it('should fail with no Authorization header', async () => {
			const res = await app.request('/api/admin/posts');
			expect(res.status).toBe(401); // Unauthorized
            const text = await res.text();
            expect(text).toContain("Unauthorized");
		});

        it('should fail with malformed Authorization header', async () => {
			const res = await app.request('/api/admin/posts', {
                headers: { Authorization: `Basic some-credentials`}, // Wrong scheme
            });
			expect(res.status).toBe(400); // Hono bearerAuth middleware returns 400 for malformed Authorization header
            const text = await res.text();
            expect(text).toContain("Bad Request"); // Or a more specific message if bearerAuth handles it
		});
	});
});
