// src/durable_objects/PostDO.ts

import { DurableObject } from 'cloudflare:workers';
import type { Post } from '../types';

export class PostDO extends DurableObject {
	constructor(ctx, env) {super(ctx, env)};


	/**
	 * The fetch handler acts as a router for the Durable Object.
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/get': {
				const post = await this.ctx.storage.get<Post>('post');
				if (!post) {
					return new Response('Post not found', { status: 404 });
				}
				return new Response(JSON.stringify(post), { headers: { 'Content-Type': 'application/json' } });
			}
			case '/create': {
				const post = await request.json<Post>();
				await this.ctx.storage.put('post', post);
				return new Response('OK', { status: 201 });
			}
			case '/update': {
				const updates = await request.json<Partial<Post>>();
				await this.ctx.storage.put('post', { ...((await this.ctx.storage.get('post')) ?? {}), ...updates });
				const updatedPost = await this.ctx.storage.get('post');
				return new Response(JSON.stringify(updatedPost), { headers: { 'Content-Type': 'application/json' } });
			}
			case '/delete': {
				await this.ctx.storage.deleteAll();
				return new Response('OK');
			}
			default:
				return new Response('Not found', { status: 404 });
		}
	}
}