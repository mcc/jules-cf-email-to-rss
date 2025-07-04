// src/views/rss.ts
import { Env, PostSummary } from '../types';
import { redactEmails } from '../services/redact';

export const generateRss = (posts: PostSummary[], env: Env): string => {
	const items = posts
		.map((post) => {
			const redactedSubject = redactEmails(post.subject);
			const redactedDescription = redactEmails(`A post titled "${post.subject}"`); // Explicitly redact description content
			return `
        <item>
            <title><![CDATA[${redactedSubject}]]></title>
            <link>${env.BLOG_URL}/post/${post.id}</link>
            <guid isPermaLink="true">${env.BLOG_URL}/post/${post.id}</guid>
            <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
            <description><![CDATA[${redactedDescription}]]></description>
        </item>
    `;
		})
		.join('');

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title><![CDATA[${env.BLOG_TITLE}]]></title>
    <link>${env.BLOG_URL}</link>
    <description><![CDATA[Latest posts from ${env.BLOG_TITLE}]]></description>
    <atom:link href="${env.BLOG_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${new Date(posts[0]?.publishedAt || Date.now()).toUTCString()}</lastBuildDate>
    ${items}
</channel>
</rss>`;
};