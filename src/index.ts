// src/index.ts (Corrected and Simplified)

import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import { bearerAuth } from 'hono/bearer-auth';
import type { Env } from './types';
import { handleEmail } from './handlers/email';
import publicRoutes from './handlers/public';
import adminRoutes from './handlers/admin';
import { IndexDO } from './durable_objects/IndexDO';
import { PostDO } from './durable_objects/PostDO';
//import adminHtml from './views/admin.html';
//import adminJs from './views/admin.js';

// Re-export Durable Objects for wrangler to see them
export { IndexDO, PostDO };

// Initialize the main Hono application
const app = new Hono<{ Bindings: Env }>();

// --- Middleware & Routes ---

// Admin static content
//app.get('/admin', (c) => c.html(adminHtml));
//app.get('/admin/app.js', (c) => c.text(adminJs, 200, { 'Content-Type': 'application/javascript' }));

// Secure all /api/admin/* routes with bearer token authentication
const adminApi = app.basePath('/api/admin');
adminApi.use('*', async (c, next) => {
	const auth = bearerAuth({ token: c.env.ADMIN_TOKEN });
	return auth(c, next);
});

// Register all routes
adminApi.route('/', adminRoutes);
app.route('/', publicRoutes);

// --- Main Export ---
// This is the object the Cloudflare Workers runtime interacts with.
// It MUST have a `fetch` property.
export default {
	fetch: app.fetch,
	email: handleEmail,
};

