# Agent Development Notes for Email-to-Blog Application

This document contains notes for AI developers working on this codebase.

## Key Areas & Code Structure

*   **`wrangler.toml`**: Defines the overall structure, workers, Durable Object (`EmailStoreDO`), KV bindings (`BLOG_RULES_KV`, `BLOG_ADMIN_SECRETS_KV`), and migrations. It's the central configuration for Cloudflare deployments.
*   **`email-receiver-worker`**:
    *   Handles incoming emails via Cloudflare Email Routing.
    *   Uses `postal-mime` to parse raw emails.
    *   Retrieves rules from `BLOG_RULES_KV` using `getRules()`.
    *   Applies rules to tag emails using `applyRulesToEmail()`.
    *   Stores parsed email data (including tags) into `EmailStoreDO` using `addEmail()`.
    *   The `EmailStoreDO` class itself is also defined in this worker's `index.js` file. This is the authoritative definition for the DO.
*   **`public-blog-worker`**:
    *   Serves the public-facing blog page (`/`) and individual post pages (`/post/:id`).
    *   Generates an RSS feed (`/rss`).
    *   Fetches email data from `EmailStoreDO`.
    *   **CRITICAL:** Contains `formatBody()` which needs robust HTML sanitization to prevent XSS. A placeholder and warning are currently in place.
*   **`admin-worker`**:
    *   Handles the admin interface.
    *   Implements Google OAuth 2.0 for authentication (`/auth/google`, `/auth/google/callback`).
    *   **CRITICAL:** OAuth callback currently authenticates any Google user. Needs an authorization step to check against a list of admin emails (placeholder and `CRITICAL TODO` comment exist).
    *   Provides API endpoints (`/admin/api/rules/*`, `/admin/api/posts/*`) for managing rules and posts. These interact with `BLOG_RULES_KV` and `EmailStoreDO`.
    *   Serves HTML pages for admin tasks (`/admin/rules`, `/admin/posts`, `/admin/dashboard`) with client-side JavaScript to interact with the APIs.

## Important Considerations for Future Development

1.  **HTML Sanitization (Public Blog):**
    *   **File:** `workers/public-blog-worker/src/index.js` (function `formatBody`)
    *   **Task:** Replace the placeholder/warning with a robust HTML sanitization library (e.g., DOMPurify or a Worker-compatible equivalent) to prevent XSS vulnerabilities when displaying email content that might be HTML. This is the highest priority security fix.

2.  **Admin Authorization (Admin Worker):**
    *   **File:** `workers/admin-worker/src/index.js` (within `/auth/google/callback` route)
    *   **Task:** Implement the check to ensure that the authenticated Google user's email is present in a list of authorized administrators. This list could be stored in `BLOG_ADMIN_SECRETS_KV` (e.g., under a key like `ADMIN_EMAILS`).

3.  **Shared Code Refactoring:**
    *   The `escapeHtml` utility is duplicated in `public-blog-worker` and `admin-worker`.
    *   The KV rule management functions (`getRulesKV`, `addRuleKV`, etc.) were initially in `email-receiver-worker` and then copied/extended into `admin-worker`.
    *   **Task:** If a build step (e.g., using Webpack or esbuild with Wrangler) is introduced, these utilities should be moved to a shared module/directory (e.g., `common/`) and imported by the respective workers to reduce duplication and improve maintainability.

4.  **Session Management Security (Admin Worker):**
    *   **File:** `workers/admin-worker/src/index.js`
    *   **Task:** The current session cookie is not signed or encrypted. For enhanced security, implement cookie signing (and potentially encryption) using a library like `jose` and a `COOKIE_SECRET` stored securely in `BLOG_ADMIN_SECRETS_KV`.

5.  **Rule Engine Enhancements:**
    *   **Files:** `workers/email-receiver-worker/src/index.js` (rule application), `workers/admin-worker/src/index.js` (rule management UI/API).
    *   **Task (Optional):**
        *   Support for regex patterns in rules (currently "contains" only).
        *   Support for `matchType: "ANY"` in addition to "ALL".
        *   More complex rule actions beyond just tagging.

6.  **Error Handling and Logging:**
    *   While basic error handling is in place, consider integrating a more structured logging solution (e.g., sending logs to a third-party service or another Worker) for easier debugging in a deployed environment.

7.  **Post Content Editing (Admin Worker):**
    *   **Task:** Implement functionality for admins to edit the content of existing posts. This would involve:
        *   An API endpoint (e.g., `PUT /admin/api/posts/:id`) in `admin-worker`.
        *   A method in `EmailStoreDO` (e.g., `updateEmailContent(id, newBody, newTags)` - a placeholder already exists).
        *   A form/editor interface on the `/admin/posts` page or a new `/admin/posts/:id/edit` page.

## Testing Notes for Agents

*   When modifying email parsing (`email-receiver-worker`), ensure various email formats (plain text, HTML, multipart) are still handled correctly.
*   When changing rule logic, test with various rule configurations and email contents to ensure tags are applied as expected.
*   Admin panel changes should always be tested with authentication active (logged-in state) and also verify that unauthenticated access to protected API endpoints and pages is denied/redirected.
*   Verify that changes to `EmailStoreDO` methods are compatible with all workers that use it (`email-receiver-worker`, `public-blog-worker`, `admin-worker`).
```
