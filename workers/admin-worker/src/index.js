// Admin Worker - Handles Admin UI and Authentication

// Constants (normally from env or KV for client_id)
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const SESSION_COOKIE_NAME = '__session';

// Helper to get base URL (protocol + hostname)
function getBaseUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}


// --- START: Rule Management KV Utilities (copied and extended from email-receiver-worker) ---
/*
Rule Data Structure (stored in BLOG_RULES_KV):
{
  "id": "string (UUID)",
  "name": "string (descriptive name, e.g., 'Tech Newsletters')",
  "senderPattern": "string (case-insensitive contains)",
  "recipientPattern": "string (case-insensitive contains)",
  "titlePattern": "string (case-insensitive contains)",
  "tags": ["string"], // Should be comma-separated in form, then split
  "matchType": "ALL", // Currently only ALL is supported.
  "createdAt": "ISO8601_string_timestamp",
  "enabled": true // boolean
}
KV keys:
- "rule_<id>" -> JSON string of the rule object
- "rules_index" -> JSON string of an array of rule IDs: ["id1", "id2", ...]
*/

async function getRulesKV(kv) {
  if (!kv) {
    console.warn("BLOG_RULES_KV not bound or available in getRulesKV.");
    return [];
  }
  const ruleIndexJson = await kv.get("rules_index");
  if (!ruleIndexJson) return [];
  const ruleIds = JSON.parse(ruleIndexJson);
  if (!ruleIds || ruleIds.length === 0) return [];

  const rulePromises = ruleIds.map(id => kv.get(`rule_${id}`));
  const ruleJsonStrings = await Promise.all(rulePromises);
  return ruleJsonStrings.filter(json => json).map(json => JSON.parse(json))
    .sort((a,b) => (a.name || "").localeCompare(b.name || "")); // Sort by name for admin UI
}

async function getRuleByIdKV(kv, ruleId) {
  if (!kv) return null;
  const ruleJson = await kv.get(`rule_${ruleId}`);
  return ruleJson ? JSON.parse(ruleJson) : null;
}

async function addRuleKV(kv, ruleData) {
  if (!kv) throw new Error("BLOG_RULES_KV not available for addRuleKV");
  const ruleId = ruleData.id || crypto.randomUUID();
  const rule = {
    id: ruleId,
    name: ruleData.name || "",
    senderPattern: ruleData.senderPattern || "",
    recipientPattern: ruleData.recipientPattern || "",
    titlePattern: ruleData.titlePattern || "",
    tags: Array.isArray(ruleData.tags) ? ruleData.tags : (ruleData.tags || "").split(',').map(t => t.trim()).filter(t => t),
    matchType: ruleData.matchType || "ALL",
    enabled: ruleData.enabled !== undefined ? (typeof ruleData.enabled === 'string' ? ruleData.enabled === 'true' : !!ruleData.enabled) : true,
    createdAt: new Date().toISOString(),
  };

  await kv.put(`rule_${ruleId}`, JSON.stringify(rule));
  const indexJson = await kv.get("rules_index");
  const index = indexJson ? JSON.parse(indexJson) : [];
  if (!index.includes(ruleId)) {
    index.push(ruleId);
    await kv.put("rules_index", JSON.stringify(index));
  }
  return rule;
}

async function updateRuleKV(kv, ruleId, ruleData) {
  if (!kv) throw new Error("BLOG_RULES_KV not available for updateRuleKV");
  const existingRule = await getRuleByIdKV(kv, ruleId);
  if (!existingRule) throw new Error("Rule not found for update");

  const updatedRule = {
    ...existingRule,
    ...ruleData,
    id: ruleId, // Ensure ID is not changed
    tags: Array.isArray(ruleData.tags) ? ruleData.tags : (ruleData.tags || "").split(',').map(t => t.trim()).filter(t => t),
    enabled: ruleData.enabled !== undefined ? (typeof ruleData.enabled === 'string' ? ruleData.enabled === 'true' : !!ruleData.enabled) : existingRule.enabled,
    updatedAt: new Date().toISOString(),
  };
  // Prevent critical fields from being wiped if not provided in ruleData
  updatedRule.name = ruleData.name !== undefined ? ruleData.name : existingRule.name;
  updatedRule.senderPattern = ruleData.senderPattern !== undefined ? ruleData.senderPattern : existingRule.senderPattern;
  updatedRule.recipientPattern = ruleData.recipientPattern !== undefined ? ruleData.recipientPattern : existingRule.recipientPattern;
  updatedRule.titlePattern = ruleData.titlePattern !== undefined ? ruleData.titlePattern : existingRule.titlePattern;


  await kv.put(`rule_${ruleId}`, JSON.stringify(updatedRule));
  return updatedRule;
}

async function deleteRuleKV(kv, ruleId) {
  if (!kv) throw new Error("BLOG_RULES_KV not available for deleteRuleKV");
  await kv.delete(`rule_${ruleId}`);
  const indexJson = await kv.get("rules_index");
  if (indexJson) {
    let index = JSON.parse(indexJson);
    index = index.filter(id => id !== ruleId);
    await kv.put("rules_index", JSON.stringify(index));
  }
  return { success: true };
}
// --- END: Rule Management KV Utilities ---


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Retrieve secrets from KV
    // In a real app, cache these or fetch them once at worker startup if possible,
    // but KV reads are generally fast.
    const GOOGLE_CLIENT_ID = await env.BLOG_ADMIN_SECRETS_KV.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = await env.BLOG_ADMIN_SECRETS_KV.get("GOOGLE_CLIENT_SECRET");
    // COOKIE_SECRET is for signing/encrypting session cookie content, very important!
    // For this example, we'll use a simpler session, but if we signed cookies, we'd need it.
    // const COOKIE_SECRET = await env.BLOG_ADMIN_SECRETS_KV.get("COOKIE_SECRET");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response("OAuth client ID or secret not configured in KV (BLOG_ADMIN_SECRETS_KV).", { status: 500 });
    }
    // if (!COOKIE_SECRET) {
    //   return new Response("COOKIE_SECRET not configured in KV.", { status: 500 });
    // }

    const redirectUri = `${getBaseUrl(request)}/auth/google/callback`;

    if (path === '/auth/google') {
      // Redirect to Google for authentication
      const authParams = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile', // Request basic profile and email
        access_type: 'offline', // If you need refresh tokens
        prompt: 'consent', // Force consent screen for testing
      });
      return Response.redirect(`${GOOGLE_AUTH_URL}?${authParams.toString()}`, 302);
    }

    if (path === '/auth/google/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing authorization code from Google.', { status: 400 });
      }

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const errorBody = await tokenResponse.text();
          console.error("Google token exchange error:", errorBody);
          return new Response(`Google token exchange failed: ${tokenResponse.statusText}. Details: ${errorBody}`, { status: 500 });
        }

        const tokenData = await tokenResponse.json();
        // id_token contains user info, access_token is for Google APIs
        // For simplicity, we'll fetch user info directly using access_token as well.

        const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });

        if (!userInfoResponse.ok) {
          return new Response('Failed to fetch user info from Google.', { status: 500 });
        }
        const userInfo = await userInfoResponse.json();

        // CRITICAL TODO: Implement proper admin authorization.
        // Check if userInfo.email is in a list of authorized admin emails.
        // This list could be stored in KV or as a comma-separated environment variable.
        // Example:
        // const ADMIN_EMAILS_KV = await env.BLOG_ADMIN_SECRETS_KV.get("ADMIN_EMAILS");
        // const ADMIN_EMAILS = ADMIN_EMAILS_KV ? ADMIN_EMAILS_KV.split(',') : [];
        // if (!ADMIN_EMAILS.includes(userInfo.email)) {
        //   console.warn(`Unauthorized login attempt by: ${userInfo.email}`);
        //   return new Response('Forbidden: You are not an authorized administrator.', { status: 403 });
        // }
        console.log("User authenticated and authorized (stub):", userInfo.email);

        // Set a session cookie (simple version, consider signing/encrypting in production)
        // The cookie stores the user's email.
        const cookieValue = userInfo.email; // In prod, use an opaque session ID or JWT
        const cookieOptions = [
          `${SESSION_COOKIE_NAME}=${cookieValue}`,
          'Path=/',
          'HttpOnly', // Important for security
          'Secure',   // Important for security (only send over HTTPS)
          'SameSite=Lax',
          `Max-Age=${60 * 60 * 24 * 7}` // 7 days
        ];

        const headers = new Headers({ 'Location': '/admin/dashboard' });
        headers.append('Set-Cookie', cookieOptions.join('; '));
        return new Response(null, { status: 302, headers });

      } catch (error) {
        console.error("OAuth callback error:", error);
        return new Response(`OAuth callback processing error: ${error.message}`, { status: 500 });
      }
    }

    if (path === '/auth/logout') {
      // Clear the session cookie
      const cookieOptions = [
        `${SESSION_COOKIE_NAME}=`, // Set to empty
        'Path=/',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT' // Expire immediately
      ];
      const headers = new Headers({ 'Location': '/admin/login' }); // Redirect to a login page
      headers.append('Set-Cookie', cookieOptions.join('; '));
      return new Response(null, { status: 302, headers });
    }

    const sessionEmail = getCookie(request, SESSION_COOKIE_NAME);
    const MAIN_DO_ID = "MAIN_EMAIL_STORE"; // For EmailStoreDO, must match other workers

    // API routes for rules (require authentication)
    if (path.startsWith('/admin/api/rules')) {
      if (!sessionEmail) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const ruleId = path.split('/')[4]; // e.g., /admin/api/rules/{id}

      try {
        if (request.method === 'GET') {
          if (ruleId) {
            const rule = await getRuleByIdKV(env.BLOG_RULES_KV, ruleId);
            return rule ? new Response(JSON.stringify(rule), { headers: { 'Content-Type': 'application/json' } })
                        : new Response(JSON.stringify({ error: 'Rule not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          } else {
            const rules = await getRulesKV(env.BLOG_RULES_KV);
            return new Response(JSON.stringify(rules), { headers: { 'Content-Type': 'application/json' } });
          }
        } else if (request.method === 'POST' && !ruleId) {
          const ruleData = await request.json();
          const newRule = await addRuleKV(env.BLOG_RULES_KV, ruleData);
          return new Response(JSON.stringify(newRule), { status: 201, headers: { 'Content-Type': 'application/json' } });
        } else if (request.method === 'PUT' && ruleId) {
          const ruleData = await request.json();
          const updatedRule = await updateRuleKV(env.BLOG_RULES_KV, ruleId, ruleData);
          return new Response(JSON.stringify(updatedRule), { headers: { 'Content-Type': 'application/json' } });
        } else if (request.method === 'DELETE' && ruleId) {
          await deleteRuleKV(env.BLOG_RULES_KV, ruleId);
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed or invalid endpoint for rules' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        console.error("Rule API error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // API routes for posts (require authentication)
    if (path.startsWith('/admin/api/posts')) {
      if (!sessionEmail) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const postId = path.split('/')[4]; // e.g., /admin/api/posts/{id}

      try {
        const doId = env.EMAIL_STORE_DO.idFromName(MAIN_DO_ID);
        const doStub = env.EMAIL_STORE_DO.get(doId);

        if (request.method === 'GET' && !postId) {
          const posts = await doStub.getEmails(); // This is an RPC call
          return new Response(JSON.stringify(posts), { headers: { 'Content-Type': 'application/json' } });
        } else if (request.method === 'DELETE' && postId) {
          const result = await doStub.deleteEmail(postId); // RPC call
          if (result.success) {
            return new Response(null, { status: 204 });
          } else {
            return new Response(JSON.stringify({ error: result.error || 'Failed to delete post' }), { status: result.error === 'not_found' ? 404 : 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
        // Add PUT for updating post content later if needed
        return new Response(JSON.stringify({ error: 'Method not allowed or invalid endpoint for posts' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        console.error("Post API error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // HTML Page routes (require authentication for /admin/*)
    if (path.startsWith('/admin')) {
      if (!sessionEmail && path !== '/admin/login') { // Allow /admin/login to be accessed without session
        return Response.redirect(`${getBaseUrl(request)}/admin/login`, 302);
      }

      if (path === '/admin/dashboard') {
        return new Response(adminDashboardHtml(sessionEmail, getBaseUrl(request)), { headers: { 'Content-Type': 'text/html' } });
      }
      if (path === '/admin/rules') {
        return new Response(adminRulesHtml(sessionEmail, getBaseUrl(request)), { headers: { 'Content-Type': 'text/html' } });
      }
      if (path === '/admin/posts') {
        return new Response(adminPostsHtml(sessionEmail, getBaseUrl(request)), { headers: { 'Content-Type': 'text/html' } });
      }
    }

    if (path === '/admin/login' || path === '/admin/' || path === '/admin') {
         return new Response(adminLoginHtml(getBaseUrl(request)), { headers: { 'Content-Type': 'text/html' }} );
    }

    return new Response('Not Found in Admin Worker', { status: 404 });
  }
};

// --- HTML Generating Functions ---
function adminLoginHtml(baseUrl) {
  return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Admin Login</title>${adminStyles()}</head><body>
    <div class="container"><h1>Admin Login</h1><p><a href="/auth/google" class="button">Login with Google</a></p></div>
    </body></html>`;
}

function adminDashboardHtml(email, baseUrl) {
  return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Admin Dashboard</title>${adminStyles()}</head><body>
    ${adminNav(email, baseUrl)}
    <div class="container"><h1>Admin Dashboard</h1><p>Welcome, ${escapeHtml(email)}!</p></div>
    </body></html>`;
}

function adminPostsHtml(email, baseUrl) {
  return `
  <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Manage Posts</title>${adminStyles()}</head>
  <body>
    ${adminNav(email, baseUrl)}
    <div class="container">
      <h1>Manage Posts</h1>
      <table id="postsTable">
        <thead><tr><th>Subject</th><th>From</th><th>Received</th><th>Tags</th><th>Actions</th></tr></thead>
        <tbody><!-- Posts will be populated here by JS --></tbody>
      </table>
    </div>
    <script>
      const postsTableBody = document.getElementById('postsTable').getElementsByTagName('tbody')[0];

      async function fetchPosts() {
        const response = await fetch('/admin/api/posts');
        const posts = await response.json();
        postsTableBody.innerHTML = ''; // Clear existing rows
        if (posts && posts.length > 0) {
          posts.forEach(post => {
            const row = postsTableBody.insertRow();
            row.insertCell().textContent = post.subject || '(No Subject)';
            row.insertCell().textContent = post.from;
            row.insertCell().textContent = new Date(post.receivedAt).toLocaleString();
            row.insertCell().textContent = post.tags ? post.tags.join(', ') : '';

            const actionsCell = row.insertCell();
            // Add Edit button placeholder if we implement edit later
            // const editButton = document.createElement('button');
            // editButton.textContent = 'Edit';
            // editButton.classList.add('button', 'small');
            // editButton.onclick = () => { /* TODO: Implement edit post */ alert('Edit not implemented yet.'); };
            // actionsCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.classList.add('button', 'small', 'danger');
            deleteButton.onclick = () => deletePost(post.id);
            actionsCell.appendChild(deleteButton);
          });
        } else {
          const row = postsTableBody.insertRow();
          const cell = row.insertCell();
          cell.colSpan = 5;
          cell.textContent = 'No posts found.';
          cell.style.textAlign = 'center';
        }
      }

      async function deletePost(id) {
        if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;
        try {
            const response = await fetch(\`/admin/api/posts/\${id}\`, { method: 'DELETE' });
            if (!response.ok && response.status !== 204) { // 204 No Content is a success for DELETE
                const errorResult = await response.json();
                throw new Error(errorResult.error || 'Failed to delete post');
            }
            fetchPosts(); // Refresh the list
        } catch (err) {
            alert('Error deleting post: ' + err.message);
        }
      }

      // Initial load
      fetchPosts();
    </script>
  </body></html>`;
}


function adminRulesHtml(email, baseUrl) {
  // This HTML will include client-side JavaScript to fetch and manage rules
  return `
  <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Manage Rules</title>${adminStyles()}</head>
  <body>
    ${adminNav(email, baseUrl)}
    <div class="container">
      <h1>Manage Rules</h1>
      <form id="ruleForm">
        <input type="hidden" id="ruleId" name="id">
        <div><label for="name">Name:</label><input type="text" id="name" name="name" required></div>
        <div><label for="senderPattern">Sender Pattern (contains):</label><input type="text" id="senderPattern" name="senderPattern"></div>
        <div><label for="recipientPattern">Recipient Pattern (contains):</label><input type="text" id="recipientPattern" name="recipientPattern"></div>
        <div><label for="titlePattern">Title Pattern (contains):</label><input type="text" id="titlePattern" name="titlePattern"></div>
        <div><label for="tags">Tags (comma-separated):</label><input type="text" id="tags" name="tags" required></div>
        <div><label for="enabled">Enabled:</label><input type="checkbox" id="enabled" name="enabled" checked></div>
        <button type="submit" class="button">Save Rule</button>
        <button type="button" id="clearFormButton" class="button secondary">Clear Form</button>
      </form>
      <h2>Existing Rules</h2>
      <table id="rulesTable">
        <thead><tr><th>Name</th><th>Sender</th><th>Recipient</th><th>Title</th><th>Tags</th><th>Enabled</th><th>Actions</th></tr></thead>
        <tbody><!-- Rules will be populated here by JS --></tbody>
      </table>
    </div>
    <script>
      const ruleForm = document.getElementById('ruleForm');
      const rulesTableBody = document.getElementById('rulesTable').getElementsByTagName('tbody')[0];
      const clearFormButton = document.getElementById('clearFormButton');

      async function fetchRules() {
        const response = await fetch('/admin/api/rules');
        const rules = await response.json();
        rulesTableBody.innerHTML = ''; // Clear existing rows
        rules.forEach(rule => {
          const row = rulesTableBody.insertRow();
          row.insertCell().textContent = rule.name;
          row.insertCell().textContent = rule.senderPattern;
          row.insertCell().textContent = rule.recipientPattern;
          row.insertCell().textContent = rule.titlePattern;
          row.insertCell().textContent = rule.tags.join(', ');
          row.insertCell().textContent = rule.enabled ? 'Yes' : 'No';
          const actionsCell = row.insertCell();
          const editButton = document.createElement('button');
          editButton.textContent = 'Edit';
          editButton.classList.add('button', 'small');
          editButton.onclick = () => loadRuleForEditing(rule);
          actionsCell.appendChild(editButton);
          const deleteButton = document.createElement('button');
          deleteButton.textContent = 'Delete';
          deleteButton.classList.add('button', 'small', 'danger');
          deleteButton.onclick = () => deleteRule(rule.id);
          actionsCell.appendChild(deleteButton);
        });
      }

      function loadRuleForEditing(rule) {
        document.getElementById('ruleId').value = rule.id;
        document.getElementById('name').value = rule.name;
        document.getElementById('senderPattern').value = rule.senderPattern;
        document.getElementById('recipientPattern').value = rule.recipientPattern;
        document.getElementById('titlePattern').value = rule.titlePattern;
        document.getElementById('tags').value = rule.tags.join(', ');
        document.getElementById('enabled').checked = rule.enabled;
        window.scrollTo(0,0); // Scroll to top to see form
      }

      function clearForm() {
        ruleForm.reset();
        document.getElementById('ruleId').value = ''; // Clear hidden ID field
        document.getElementById('enabled').checked = true; // Default to enabled
      }
      clearFormButton.addEventListener('click', clearForm);


      ruleForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const id = document.getElementById('ruleId').value;
        const formData = new FormData(ruleForm);
        const data = Object.fromEntries(formData.entries());
        // FormData 'enabled' is "on" or undefined, convert to boolean
        data.enabled = document.getElementById('enabled').checked;
        // Tags are comma separated string, will be parsed by server

        const method = id ? 'PUT' : 'POST';
        const url = id ? \`/admin/api/rules/\${id}\` : '/admin/api/rules';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || 'Failed to save rule');
            }
            clearForm();
            fetchRules(); // Refresh the list
        } catch (err) {
            alert('Error saving rule: ' + err.message);
        }
      });

      async function deleteRule(id) {
        if (!confirm('Are you sure you want to delete this rule?')) return;
        try {
            const response = await fetch(\`/admin/api/rules/\${id}\`, { method: 'DELETE' });
            if (!response.ok && response.status !== 204) { // 204 No Content is a success for DELETE
                const errorResult = await response.json();
                throw new Error(errorResult.error || 'Failed to delete rule');
            }
            fetchRules(); // Refresh the list
        } catch (err) {
            alert('Error deleting rule: ' + err.message);
        }
      }

      // Initial load
      fetchRules();
    </script>
  </body></html>`;
}

function adminNav(email, baseUrl) {
  return `
    <nav class="admin-nav">
      <span>Logged in as: ${escapeHtml(email)}</span>
      <a href="/admin/dashboard">Dashboard</a> |
      <a href="/admin/rules">Manage Rules</a> |
      <a href="/admin/posts">Manage Posts</a> |
      <a href="/auth/logout">Logout</a>
    </nav>`;
}

function adminStyles() {
  return \`
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background-color: #f4f4f4; color: #333; }
      .container { max-width: 900px; margin: 20px auto; padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
      .admin-nav { background-color: #333; color: white; padding: 10px 20px; text-align: right; }
      .admin-nav a { color: white; text-decoration: none; margin-left: 15px; }
      .admin-nav span { float: left; }
      h1, h2 { color: #333; }
      label { display: block; margin-top: 10px; font-weight: bold; }
      input[type="text"], input[type="password"], select { width: calc(100% - 22px); padding: 10px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
      input[type="checkbox"] { margin-top: 5px; }
      .button, button { background-color: #007bff; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin-top:10px; }
      .button.secondary, button.secondary { background-color: #6c757d; }
      .button.danger, button.danger { background-color: #dc3545; }
      .button.small, button.small { padding: 5px 10px; font-size: 0.9em; margin-left: 5px;}
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f0f0f0; }
      form div { margin-bottom: 10px; }
    </style>
  \`;
}

// Helper to parse cookies from request

// Helper to parse cookies from request
function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (let cookie of cookies) {
      const parts = cookie.split('=');
      const key = parts[0].trim();
      if (key === name) {
        return parts[1] ? parts[1].trim() : undefined;
      }
    }
  }
  return undefined;
}

// Utility to escape HTML characters (duplicate from public-blog-worker, consider shared utils later)
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
