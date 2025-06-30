// Public Blog Worker

// Constant ID for our single email store DO, must match the one in email-receiver-worker
const MAIN_DO_ID = "MAIN_EMAIL_STORE";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const doId = env.EMAIL_STORE_DO.idFromName(MAIN_DO_ID);
    const doStub = env.EMAIL_STORE_DO.get(doId);
    const path = url.pathname;

    try {
      if (path === '/rss') {
        return this.generateRssFeed(doStub, env, url.origin);
      } else if (path === '/') {
        return this.generateHtmlBlog(doStub, env, url.origin);
      } else if (path.startsWith('/post/')) {
        const postId = path.substring('/post/'.length);
        if (postId) {
          return this.generateSinglePostHtml(doStub, env, postId, url.origin);
        }
      }
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error("Error in public-blog-worker:", error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  async generateHtmlBlog(doStub, env) {
    const emails = await doStub.getEmails(); // This is an RPC call to the DO

    let postsHtml = emails.map(email => `
      <article>
        <h2>${escapeHtml(email.subject || 'No Subject')}</h2>
        <p><em>From: ${escapeHtml(email.from)} | Received: ${new Date(email.receivedAt).toLocaleString()}</em></p>
        ${email.tags && email.tags.length > 0 ? `<p>Tags: ${email.tags.map(tag => escapeHtml(tag)).join(', ')}</p>` : ''}
        <div>${formatBody(email.body)}</div>
      </article>
      <hr/>
    `).join('');

    if (emails.length === 0) {
      postsHtml = "<p>No posts yet. Send an email to your configured address!</p>";
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My Email Blog</title>
        <style>
          body { font-family: sans-serif; line-height: 1.6; margin: 20px; background-color: #f4f4f4; color: #333; }
          header { text-align: center; margin-bottom: 30px; }
          article { background-color: #fff; padding: 20px; margin-bottom: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          h1 { color: #333; }
          h2 { color: #555; }
          a { color: #007bff; }
          hr { border: 0; height: 1px; background: #ddd; }
          .rss-link { display: block; text-align: center; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <header>
          <h1>My Email Blog</h1>
          <p class="rss-link"><a href="/rss">RSS Feed</a></p>
        </header>
        <main>
          ${postsHtml}
        </main>
        <footer>
          <p style="text-align:center; font-size:0.8em; color:#777;">Powered by Cloudflare Workers & Email</p>
        </footer>
      </body>
      </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  },

  async generateRssFeed(doStub, env, baseUrl) {
    const emails = await doStub.getEmails(); // RPC call

    const feedItems = emails.map(email => {
      const postUrl = `${baseUrl}/post/${email.id}`; // Assuming we'll have individual post pages eventually
      return `
        <item>
          <title>${escapeHtml(email.subject || 'No Subject')}</title>
          <link>${postUrl}</link>
          <guid isPermaLink="true">${postUrl}</guid>
          <pubDate>${new Date(email.receivedAt).toUTCString()}</pubDate>
          <description><![CDATA[
            ${formatBody(email.body, true)}
            ${email.tags && email.tags.length > 0 ? `<p>Tags: ${email.tags.map(tag => escapeHtml(tag)).join(', ')}</p>` : ''}
          ]]></description>
          <author>${escapeHtml(email.from)}</author>
        </item>
      `;
    }).join('');

    const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
      <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
      <channel>
        <title>My Email Blog</title>
        <link>${baseUrl}</link>
        <description>Latest posts from my email blog.</description>
        <language>en-us</language>
        <lastBuildDate>${emails.length > 0 ? new Date(emails[0].receivedAt).toUTCString() : new Date().toUTCString()}</lastBuildDate>
        <atom:link href="${baseUrl}/rss" rel="self" type="application/rss+xml" />
        ${feedItems}
      </channel>
      </rss>
    `;
    return new Response(rssXml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
  },

  async generateSinglePostHtml(doStub, env, postId, baseUrl) {
    const email = await doStub.getEmailById(postId); // RPC call

    if (!email) {
      return new Response('Post Not Found', { status: 404 });
    }

    const postHtml = `
      <article>
        <h1>${escapeHtml(email.subject || 'No Subject')}</h1>
        <p><em>From: ${escapeHtml(email.from)} | Received: ${new Date(email.receivedAt).toLocaleString()}</em></p>
        ${email.tags && email.tags.length > 0 ? `<p>Tags: ${email.tags.map(tag => escapeHtml(tag)).join(', ')}</p>` : ''}
        <div>${formatBody(email.body)}</div>
      </article>
    `;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(email.subject || 'No Subject')} - My Email Blog</title>
        <style>
          body { font-family: sans-serif; line-height: 1.6; margin: 0; background-color: #f4f4f4; color: #333; }
          .container { max-width: 800px; margin: 20px auto; padding: 20px; background-color: #fff; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          header { margin-bottom: 20px; }
          article h1 { color: #333; }
          a { color: #007bff; }
          .back-link { margin-bottom: 20px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <a href="/" class="back-link">&laquo; Back to Blog Home</a>
          </header>
          <main>
            ${postHtml}
          </main>
          <footer>
            <p style="text-align:center; font-size:0.8em; color:#777;">Powered by Cloudflare Workers & Email</p>
          </footer>
        </div>
      </body>
      </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};

// Utility to escape HTML characters
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Utility to format email body (simple version)
function formatBody(body, forRss = false) {
  if (!body) return '';

  // CRITICAL SECURITY TODO: Implement HTML sanitization here if body contains HTML.
  // Displaying raw HTML from emails is a major XSS vulnerability.
  // Use a library like DOMPurify or a Cloudflare Worker compatible equivalent.
  // Example (conceptual, actual library usage will vary):
  // if (isHtmlEmail) {
  //   const Sentry = require('@sentry/browser'); // Or your preferred sanitizer
  //   const cleanHtml = Sentry.sanitize(htmlContent); // This is not actual Sentry API
  //   return cleanHtml;
  // }

  if (body.startsWith("HTML content found (displaying raw HTML):\\n")) {
    const htmlContent = body.substring("HTML content found (displaying raw HTML):\\n".length);
    // **WARNING: Displaying raw HTML like this is unsafe without sanitization!**
    if (forRss) {
      // For RSS, CDATA helps, but content itself should still be clean if rendered by clients.
      return `<![CDATA[${htmlContent}]]>`; // Wrapping in CDATA for RSS
    } else {
      return `<div><!-- UNSAFE HTML START -->${htmlContent}<!-- UNSAFE HTML END --></div>`;
    }
  }
  // Otherwise, assume plain text and convert newlines.
  const escaped = escapeHtml(body);
  return `<p>${escaped.replace(/\n/g, '<br />')}</p>`; // Always escape plain text
}
