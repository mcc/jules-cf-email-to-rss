// src/types.ts

import { DurableObjectNamespace } from 'cloudflare:workers';

// Environment Bindings defined in wrangler.jsonc
export interface Env {
	POST_INDEX: DurableObjectNamespace;
	POST_STORAGE: DurableObjectNamespace;
	BLOG_RULES: KVNamespace;

	ADMIN_TOKEN: string;
	BLOG_TITLE: string;
	BLOG_URL: string;
}

// Stored data for a single blog post
export interface Post {
	id: string;
	from: { address: string; name: string };
	to: { address: string; name: string };
	subject: string;
	html: string | null;
	text: string | null;
	tags: string[];
	publishedAt: string;
	isPublished: boolean;
}

// A summary of a post, used for list views
export type PostSummary = Pick<Post, 'id' | 'subject' | 'tags' | 'publishedAt' | 'isPublished'>;

// Structure for a tagging rule
export interface TaggingRule {
	id: string;
	priority: number; // Lower numbers run first
	conditions: RuleCondition[];
	tagsToAdd: string[];
}

export interface RuleCondition {
	field: 'from' | 'to' | 'subject';
	operator: 'contains' | 'equals';
	value: string;
}