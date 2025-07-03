// src/handlers/admin.ts

import { Hono } from 'hono';
import { getRules } from '../services/rules';
import type { Env, Post, PostSummary, TaggingRule } from '../types';

const adminRoutes = new Hono<{ Bindings: Env }>();

// --- Posts API ---

// List all posts (published and drafts)
adminRoutes.get('/posts', async (c) => {
	const indexId = c.env.POST_INDEX.idFromName('main-index');
	const indexStub = c.env.POST_INDEX.get(indexId);
	const res = await indexStub.fetch('http://durable-object/list');
	const posts = await res.json<PostSummary[]>();
	return c.json(posts);
});

// Get a single post's full data
adminRoutes.get('/posts/:id', async (c) => {
	const { id } = c.req.param();
	const postStorageId = c.env.POST_STORAGE.idFromString(id);
	const stub = c.env.POST_STORAGE.get(postStorageId);
	const res = await stub.fetch('http://durable-object/get');
	if (!res.ok) return c.json({ error: 'Post not found' }, 404);
	const post = await res.json<Post>();
	return c.json(post);
});

// Update a post (e.g., publish/unpublish, change tags)
adminRoutes.patch('/posts/:id', async (c) => {
	const { id } = c.req.param();
	const updates = await c.req.json<Partial<Post>>();

	const postStorageId = c.env.POST_STORAGE.idFromString(id);
	const postStub = c.env.POST_STORAGE.get(postStorageId);
	const res = await postStub.fetch('http://durable-object/update', { method: 'POST', body: JSON.stringify(updates) });
	const updatedPost = await res.json<Post>();

	// Also update the summary in the index
	const indexId = c.env.POST_INDEX.idFromName('main-index');
	const indexStub = c.env.POST_INDEX.get(indexId);
	const postSummary: PostSummary = {
		id: updatedPost.id,
		subject: updatedPost.subject,
		tags: updatedPost.tags,
		publishedAt: updatedPost.publishedAt,
		isPublished: updatedPost.isPublished,
	};
	await indexStub.fetch('http://durable-object/add', { method: 'POST', body: JSON.stringify(postSummary) });

	return c.json(updatedPost);
});

// Delete a post
adminRoutes.delete('/posts/:id', async (c) => {
	const { id } = c.req.param();
	const postStorageId = c.env.POST_STORAGE.idFromString(id);
	const postStub = c.env.POST_STORAGE.get(postStorageId);
	await postStub.fetch('http://durable-object/delete', { method: 'POST' });

	const indexId = c.env.POST_INDEX.idFromName('main-index');
	const indexStub = c.env.POST_INDEX.get(indexId);
	await indexStub.fetch('http://durable-object/remove', { method: 'POST', body: id });

	return c.json({ success: true });
});

// --- Rules API ---

// List all tagging rules
adminRoutes.get('/rules', async (c) => {
	const rules = await getRules(c.env);
	return c.json(rules);
});

// Create or update a tagging rule
adminRoutes.post('/rules', async (c) => {
	const rule = await c.req.json<TaggingRule>();
	if (!rule.id) {
		rule.id = crypto.randomUUID();
	}
	await c.env.BLOG_RULES.put(rule.id, JSON.stringify(rule));
	return c.json(rule, 201);
});

// Delete a tagging rule
adminRoutes.delete('/rules/:id', async (c) => {
	const { id } = c.req.param();
	await c.env.BLOG_RULES.delete(id);
	return c.json({ success: true });
});

export default adminRoutes;