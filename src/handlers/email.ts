// src/handlers/email.ts

import { EmailMessage } from 'cloudflare:email';
import PostalMime from 'postal-mime';
import type { Env, Post, PostSummary } from '../types';
import { applyTaggingRules } from '../services/rules';

export async function handleEmail(message: EmailMessage, env: Env) {
	try {
		// Use postal-mime to parse the raw email content
		const parser = new PostalMime();
		const email = await parser.parse(message.raw);

//		const postId = crypto.randomUUID();
		const postStorageId = env.POST_STORAGE.newUniqueId();
		const postId = postStorageId.toString();
		const publishedAt = new Date().toISOString();

		const initialPostData: Omit<Post, 'tags'> = {
			id: postId,
			from: email.from,
			to: email.to![0], // Assuming at least one recipient
			subject: email.subject || 'Untitled Post',
			html: email.html || null,
			text: email.text || null,
			publishedAt,
			isPublished: true, // Posts are published by default
		};

		// Apply rules to get initial tags
		const tags = await applyTaggingRules(initialPostData, env);

		const finalPost: Post = {
			...initialPostData,
			tags,
		};

		// Get the Durable Object stubs
		//const postStorageId = env.POST_STORAGE.idFromString(postId);
		console.log(postId);
		console.log(postStorageId);
		const postStorageStub = env.POST_STORAGE.get(postStorageId);
		const indexId = env.POST_INDEX.idFromName('main-index');
		const indexStub = env.POST_INDEX.get(indexId);

		// Store the post and update the index concurrently
		const postSummary: PostSummary = {
			id: finalPost.id,
			subject: finalPost.subject,
			tags: finalPost.tags,
			publishedAt: finalPost.publishedAt,
			isPublished: finalPost.isPublished, // This will now be true from initialPostData
		};
		
		await Promise.all([postStorageStub.fetch('http://durable-object/create', { method: 'POST', body: JSON.stringify(finalPost) }), indexStub.fetch('http://durable-object/add', { method: 'POST', body: JSON.stringify(postSummary) })]);

		console.log(`Successfully processed and stored email as post ${postId}`);
	} catch (error) {
		console.error('Failed to process email:', error);
		// Optionally, forward the email to a personal address on failure
		// await message.forward("personal-address@example.com");
	}
}