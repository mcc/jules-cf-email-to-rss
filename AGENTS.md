# Agent Instructions for email-to-blog

This document provides guidance for AI agents working on the `email-to-blog` codebase.

## Project Overview

This project is an email-to-blog service. It allows users to send emails that are then processed and published as blog posts. The service is built as a Cloudflare Workers application and utilizes several Cloudflare features.

Key technologies used:
- **Cloudflare Workers:** Serverless execution environment.
- **Hono:** A small, simple, and ultrafast web framework for the Edge.
- **TypeScript:** For static typing and improved code quality.
- **Durable Objects:** For persistent, stateful storage of blog posts and indexes.
- **KV Namespace:** For storing tagging rules.

## Development Workflow

### Language: TypeScript
- The codebase is written in TypeScript.
- Please adhere to common TypeScript best practices, including using provided types from `src/types.ts`.
- Ensure code is well-typed and leverages TypeScript's features for safety and clarity.

### Dependencies
- Node.js dependencies are managed with `npm` and defined in `package.json`.
- Key runtime dependencies include:
    - `hono`: For routing and request handling.
    - `postal-mime`: For parsing incoming emails.
- Development dependencies include `typescript`, `wrangler`, and `@cloudflare/workers-types`.
- Install dependencies using `npm install`.

### Deployment
- The application is deployed to Cloudflare Workers using Wrangler.
- The deployment command is `npm run deploy`, which executes `wrangler deploy src/index.ts`.

### Configuration
- The primary configuration file is `wrangler.jsonc`. This file contains critical settings:
    - Durable Object bindings (`POST_INDEX`, `POST_STORAGE`).
    - KV namespace bindings (`BLOG_RULES`).
    - Asset directory configuration.
    - Environment variables (`vars`) like `BLOG_TITLE`, `BLOG_URL`.
    - Secrets (e.g., `ADMIN_TOKEN`) that need to be set in the Cloudflare dashboard.
- **Caution:** Be careful when editing `wrangler.jsonc`, as incorrect configurations can break the application. Values for secrets and some IDs (like KV namespace IDs) are placeholders and need to be replaced with actual values from your Cloudflare account.

### Testing
- There are currently no automated test scripts defined in `package.json`.
- When adding new features or fixing bugs, consider how they could be tested. If you add testing infrastructure (e.g., using Vitest or Jest), please document how to run the tests.

## Code Structure

The project follows a structured organization within the `src/` directory:

-   **`src/index.ts`**: The main entry point for the Worker. It initializes the Hono application, sets up middleware, and exports the `fetch` and `email` handlers.
-   **`src/handlers/`**: Contains modules for handling different types of requests:
    -   `admin.ts`: Handles API requests for the admin interface (managing posts, rules).
    -   `email.ts`: Handles incoming email processing.
    -   `public.ts`: Handles public-facing routes (fetching posts, RSS feed).
-   **`src/durable_objects/`**: Defines the Durable Object classes:
    -   `IndexDO.ts`: Manages an index of post summaries (for listing posts efficiently).
    -   `PostDO.ts`: Stores the full content and metadata of individual blog posts.
-   **`src/services/`**: Contains business logic modules that are used by handlers.
    -   `rules.ts`: Logic for managing and applying tagging rules from email subjects.
-   **`src/types.ts`**: Centralizes TypeScript type definitions used throughout the application (e.g., `Env`, `Post`, `PostSummary`).
-   **`src/views/`**: Contains server-side templating/view logic.
    -   `layout.ts`: Basic HTML layout structure.
    -   `pages.ts`: HTML generation for public-facing blog pages.
    -   `rss.ts`: Generates the RSS feed XML.
-   **`assets/`**: Contains static assets served by the application.
    -   `assets/admin/`: Contains the HTML, CSS, and JavaScript for the admin interface.

## Important Considerations

### Durable Objects (DO)
- Durable Objects are used for persistent storage of blog posts and their indexes.
    - `POST_INDEX` (bound to `IndexDO`): Stores a list of `PostSummary` objects.
    - `POST_STORAGE` (bound to `PostDO`): Stores the full `Post` object for each blog entry.
- Interaction with Durable Objects is always asynchronous and is done by `fetch`ing a URL on the DO stub (e.g., `env.POST_INDEX.get(id).fetch(...)`).
- Each `PostDO` instance is identified by a unique ID. `IndexDO` typically uses a well-known name like "main-index".

### KV Namespaces
- The `BLOG_RULES` KV namespace is used to store tagging rules. These rules determine how posts are automatically tagged based on email subjects.
- Rules are stored as JSON strings, keyed by a unique rule ID.

### Admin Authentication
- API routes under `/api/admin/*` are protected.
- Authentication is handled by `hono/bearer-auth` middleware, which checks for a valid `ADMIN_TOKEN`.
- The `ADMIN_TOKEN` is a secret that must be configured in the Cloudflare dashboard and set via `wrangler secret put ADMIN_TOKEN`.

### Email Handling
- The `email` handler in `src/index.ts` (which calls `handleEmail` from `src/handlers/email.ts`) is triggered when an email is sent to the configured address for the Worker.
- This handler parses the email using `postal-mime`, applies tagging rules, and creates a new post in the `PostDO` and `IndexDO`.

### Static Assets for Admin UI
- The admin interface is a Single Page Application (SPA) located in `assets/admin/`.
- `index.html` and `admin.js` in this directory provide the UI for managing posts and rules.
- These are served as static files by Hono's `serveStatic` middleware, though the `src/index.ts` comments out direct serving and implies they are bundled or served via `assets` in `wrangler.jsonc`. The `assets` configuration in `wrangler.jsonc` is the active method.

---

This document should help you understand the project structure and conventions. If you make significant changes to the architecture or development workflow, please update this file accordingly.
