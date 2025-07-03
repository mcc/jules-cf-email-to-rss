// src/durable_objects/IndexDO.ts

import { DurableObject } from 'cloudflare:workers';
import type { PostSummary } from '../types';

export class IndexDO extends DurableObject {
	constructor(
        ctx, env
	) {super(ctx, env)}

	/**
	
* The fetch handler acts as a router for the Durable Object.
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/list': {
				const index = (await this.ctx.storage.get<PostSummary[]>('index')) || [];
				return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
			}
			case '/add': {
				const postSummary = await request.json<PostSummary>();
				const index = (await this.ctx.storage.get<PostSummary[]>('index')) || [];
				const existingIndex = index.findIndex((p) => p.id === postSummary.id);

				if (existingIndex > -1) {
					index[existingIndex] = postSummary; // Update existing
				} else {
					index.unshift(postSummary); // Add new to the front
				}
				await this.ctx.storage.put('index', index);
				return new Response('OK');
			}
			case '/remove': {
				const postId = await request.text();
				const index = (await this.ctx.storage.get<PostSummary[]>('index')) || [];
				const updatedIndex = index.filter((p) => p.id !== postId);
				await this.ctx.storage.put('index', updatedIndex);
				return new Response('OK');
			}
			default:
				return new Response('Not found', { status: 404 });
		}
	}
}