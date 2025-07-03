// src/services/rules.ts

import type { Env, RuleCondition, TaggingRule, Post } from '../types';

/**
 * Applies all matching rules from KV to a given post.
 */
export async function applyTaggingRules(post: Omit<Post, 'tags'>, env: Env): Promise<string[]> {
	const rules = await getRules(env);
	const tags = new Set<string>();

	for (const rule of rules) {
		if (doesPostMatchRule(post, rule)) {
			rule.tagsToAdd.forEach((tag) => tags.add(tag));
		}
	}

	return Array.from(tags);
}

/**
 * Checks if a post satisfies all conditions of a single rule.
 */
function doesPostMatchRule(post: Omit<Post, 'tags'>, rule: TaggingRule): boolean {
	return rule.conditions.every((condition) => doesPostMatchCondition(post, condition));
}

/**
 * Checks if a post satisfies a single condition.
 */
function doesPostMatchCondition(post: Omit<Post, 'tags'>, condition: RuleCondition): boolean {
	let postValue = '';
	switch (condition.field) {
		case 'from':
			postValue = post.from.address;
			break;
		case 'to':
			postValue = post.to.address;
			break;
		case 'subject':
			postValue = post.subject;
			break;
	}

	postValue = postValue.toLowerCase();
	const conditionValue = condition.value.toLowerCase();

	switch (condition.operator) {
		case 'contains':
			return postValue.includes(conditionValue);
		case 'equals':
			return postValue === conditionValue;
		default:
			return false;
	}
}

/**
 * Retrieves and sorts all rules from the KV store.
 */
export async function getRules(env: Env): Promise<TaggingRule[]> {
	const list = await env.BLOG_RULES.list();
	if (list.keys.length === 0) {
		return [];
	}

	const rules: TaggingRule[] = [];
	for (const key of list.keys) {
		const rule = await env.BLOG_RULES.get<TaggingRule>(key.name, 'json');
		if (rule) {
			rules.push(rule);
		}
	}
	// Sort by priority, ascending. Lower numbers run first.
	return rules.sort((a, b) => a.priority - b.priority);
}