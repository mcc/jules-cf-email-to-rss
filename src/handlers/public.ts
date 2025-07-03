// src/handlers/public.ts

import { Hono } from 'hono';
import type { Env, Post, PostSummary } from '../types';
import { renderBlogIndex, renderPostPage } from '../views/pages';
import { generateRss } from '../views/rss';

const publicRoutes = new Hono<{ Bindings: Env }>();

// Homepage: List all published posts
publicRoutes.get('/', async (c) => {
	const indexId = c.env.POST_INDEX.idFromName('main-index');
	const indexStub = c.env.POST_INDEX.get(indexId);
    console.log(indexStub);
	const res = await indexStub.fetch('http://durable-object/list');
	const allPosts = await res.json<PostSummary[]>();
	const publishedPosts = allPosts.filter((p) => p.isPublished);
	return c.html(renderBlogIndex(publishedPosts, c.env));
});

// Single Post Page
publicRoutes.get('/post/:id', async (c) => {
	const { id } = c.req.param();
	const postStorageId = c.env.POST_STORAGE.idFromString(id);
	const postStorageStub = c.env.POST_STORAGE.get(postStorageId);
	const res = await postStorageStub.fetch('http://durable-object/get');

	if (!res.ok) {
		return c.text('Post not found', 404);
	}

	const post = await res.json<Post>();
	if (!post || !post.isPublished) {
		return c.text('Post not found or not published', 404);
	}

	return c.html(renderPostPage(post, c.env));
});

// RSS Feed
publicRoutes.get('/rss.xml', async (c) => {
	const indexId = c.env.POST_INDEX.idFromName('main-index');
	const indexStub = c.env.POST_INDEX.get(indexId);
	const res = await indexStub.fetch('http://durable-object/list');
	const allPosts = await res.json<PostSummary[]>();
	const publishedPosts = allPosts.filter((p) => p.isPublished);

	const rssXml = generateRss(publishedPosts, c.env);
	return c.text(rssXml, 200, { 'Content-Type': 'application/rss+xml' });
});

export default publicRoutes;

