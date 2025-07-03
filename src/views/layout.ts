// src/views/layout.ts
import { Env } from '../types';

export const renderLayout = (title: string, content: string, env: Env) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | ${env.BLOG_TITLE}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #333; }
        h1, h2 { color: #111; }
        a { color: #007acc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        header { border-bottom: 1px solid #ddd; margin-bottom: 2rem; padding-bottom: 1rem; }
        .post-summary { margin-bottom: 2rem; }
        .post-meta { font-size: 0.9em; color: #666; }
        .tag { background-color: #eee; padding: 0.2em 0.5em; border-radius: 4px; font-size: 0.8em; margin-right: 0.5em; }
        .post-content { margin-top: 2rem; }
    </style>
</head>
<body>
    <header>
        <h1><a href="/">${env.BLOG_TITLE}</a></h1>
        <a href="/rss.xml">RSS Feed</a> | <a href="/admin">Admin</a>
    </header>
    <main>
        ${content}
    </main>
</body>
</html>
`;