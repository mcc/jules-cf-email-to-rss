// src/views/pages.ts
import { Env, Post, PostSummary } from '../types';
import { renderLayout } from './layout';
import { redactEmails } from '../services/redact';

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export const renderBlogIndex = (posts: PostSummary[], env: Env): string => {
	const content = `
        ${
					posts.length > 0
						? posts
								.map(
									(post) => `
            <div class="post-summary">
                <h2><a href="/post/${post.id}">${post.subject}</a></h2>
                <div class="post-meta">
                    <span>${formatDate(post.publishedAt)}</span>
                    ${post.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        `,
								)
								.join('')
						: '<p>No posts yet. Why not send an email?</p>'
				}
    `;
	return renderLayout('Home', content, env);
};

export const renderPostPage = (post: Post, env: Env): string => {
	const displayAuthor = post.from.name || redactEmails(post.from.address);
	const redactedSubject = redactEmails(post.subject);
	const redactedHtml = redactEmails(post.html);
	const redactedText = redactEmails(post.text);

	const content = `
        <article>
            <h1>${redactedSubject}</h1>
            <div class="post-meta">
                <span>By ${displayAuthor} on ${formatDate(post.publishedAt)}</span>
                 ${post.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <div class="post-content">
                ${redactedHtml || `<p>${redactedText?.replace(/\n/g, '<br>')}</p>`}
            </div>
        </article>
    `;
	return renderLayout(redactedSubject, content, env);
};