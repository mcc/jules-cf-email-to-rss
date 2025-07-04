// src/views/admin.js

document.addEventListener('DOMContentLoaded', () => {
	const authView = document.getElementById('auth-view');
	const contentView = document.getElementById('content-view');
	const tokenInput = document.getElementById('admin-token');
	const loginButton = document.getElementById('login-button');
	const logoutButton = document.getElementById('logout-button');

	let adminToken = sessionStorage.getItem('adminToken');

	const api = {
		get: (endpoint) => fetch(`/api/admin${endpoint}`, { headers: { Authorization: `Bearer ${adminToken}` } }),
		post: (endpoint, body) =>
			fetch(`/api/admin${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
				body: JSON.stringify(body),
			}),
		patch: (endpoint, body) =>
			fetch(`/api/admin${endpoint}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
				body: JSON.stringify(body),
			}),
		delete: (endpoint) => fetch(`/api/admin${endpoint}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }),
	};

	function checkAuth() {
		if (adminToken) {
			authView.style.display = 'none';
			contentView.style.display = 'block';
			loadAllData();
		} else {
			authView.style.display = 'block';
			contentView.style.display = 'none';
		}
	}

	loginButton.addEventListener('click', async () => {
		const token = tokenInput.value;
		if (!token) {
			alert('Please enter an admin token.');
			return;
		}
		try {
			const response = await fetch('/api/admin/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token }),
			});
			const result = await response.json();
			if (result.success) {
				adminToken = token;
				sessionStorage.setItem('adminToken', adminToken);
				checkAuth();
			} else {
				alert(result.message || 'Login failed.');
				tokenInput.value = ''; // Clear the input
			}
		} catch (error) {
			console.error('Login error:', error);
			alert('An error occurred during login. Please try again.');
		}
	});

	logoutButton.addEventListener('click', () => {
		adminToken = null;
		sessionStorage.removeItem('adminToken');
		checkAuth();
	});

	async function loadAllData() {
		loadPosts();
		loadRules();
	}

	async function loadPosts() {
		const postsList = document.getElementById('posts-list');
		try {
			const res = await api.get('/posts');
			if (!res.ok) throw new Error('Failed to fetch posts. Check token.');
			const posts = await res.json();
			postsList.innerHTML = posts
				.map(
					(post) => `
                <div class="post" data-id="${post.id}">
                    <h4>${post.subject}</h4>
                    <div class="post-meta">
                        <span>ID: ${post.id}</span><br>
                        <span>Received: ${new Date(post.publishedAt).toLocaleString()}</span><br>
                        <span class="status ${post.isPublished ? 'published' : 'draft'}">
                            ${post.isPublished ? 'PUBLISHED' : 'DRAFT'}
                        </span>
                    </div>
                    <div>
                        <input type="text" class="tags-input" value="${post.tags.join(', ')}">
                        <button class="save-tags">Save Tags</button>
                    </div>
                    <button class="toggle-publish">${post.isPublished ? 'Unpublish' : 'Publish'}</button>
                    <button class="delete delete-post">Delete</button>
                </div>
            `,
				)
				.join('');
		} catch (e) {
			postsList.innerHTML = `<p style="color: red;">${e.message}</p>`;
		}
	}

	async function loadRules() {
		const rulesList = document.getElementById('rules-list');
		try {
			const res = await api.get('/rules');
			if (!res.ok) throw new Error('Failed to fetch rules.');
			const rules = await res.json();
			rulesList.innerHTML = rules
				.map(
					(rule) => `
                <div class="rule" data-id="${rule.id}">
                    <p><strong>Priority:</strong> ${rule.priority}</p>
                    <p><strong>Tags:</strong> ${rule.tagsToAdd.join(', ')}</p>
                    <p><strong>Conditions:</strong></p>
                    <ul>${rule.conditions.map((c) => `<li>${c.field} ${c.operator} "${c.value}"</li>`).join('')}</ul>
                    <button class="edit-rule">Edit</button>
                    <button class="delete delete-rule">Delete</button>
                </div>
            `,
				)
				.join('');
		} catch (e) {
			rulesList.innerHTML = `<p style="color: red;">${e.message}</p>`;
		}
	}

	// Event delegation for dynamic content
	document.body.addEventListener('click', async (e) => {
		const target = e.target;
		const postDiv = target.closest('.post');
		const ruleDiv = target.closest('.rule');

		// Post actions
		if (postDiv) {
			const postId = postDiv.dataset.id;
			if (target.matches('.toggle-publish')) {
				const isPublished = !target.textContent.includes('Unpublish');
				await api.patch(`/posts/${postId}`, { isPublished });
				loadPosts();
			} else if (target.matches('.save-tags')) {
				const tags = postDiv.querySelector('.tags-input').value.split(',').map((t) => t.trim()).filter(Boolean);
				await api.patch(`/posts/${postId}`, { tags });
				loadPosts();
			} else if (target.matches('.delete-post')) {
				if (confirm('Are you sure you want to delete this post?')) {
					await api.delete(`/posts/${postId}`);
					loadPosts();
				}
			}
		}

		// Rule actions
		if (ruleDiv) {
			const ruleId = ruleDiv.dataset.id;
			if (target.matches('.delete-rule')) {
				if (confirm('Are you sure you want to delete this rule?')) {
					await api.delete(`/rules/${ruleId}`);
					loadRules();
				}
			} else if (target.matches('.edit-rule')) {
				const res = await api.get('/rules');
				const rules = await res.json();
				const ruleToEdit = rules.find(r => r.id === ruleId);
				populateRuleForm(ruleToEdit);
			}
		}
	});

	// Rule form logic
	const ruleForm = document.getElementById('rule-form');
	const conditionsContainer = document.getElementById('rule-conditions');

	function createConditionElement() {
		const div = document.createElement('div');
		div.innerHTML = `
            <select class="condition-field">
                <option value="from">From</option>
                <option value="to">To</option>
                <option value="subject">Subject</option>
            </select>
            <select class="condition-operator">
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
            </select>
            <input type="text" class="condition-value" placeholder="Value">
            <button type="button" class="remove-condition">Remove</button>
        `;
		conditionsContainer.appendChild(div);
	}

    function populateRuleForm(rule) {
        document.getElementById('rule-id').value = rule.id;
        document.getElementById('rule-priority').value = rule.priority;
        document.getElementById('rule-tags').value = rule.tagsToAdd.join(', ');
        conditionsContainer.innerHTML = '';
        rule.conditions.forEach(cond => {
            createConditionElement();
            const lastCondition = conditionsContainer.lastElementChild;
            lastCondition.querySelector('.condition-field').value = cond.field;
            lastCondition.querySelector('.condition-operator').value = cond.operator;
            lastCondition.querySelector('.condition-value').value = cond.value;
        });
    }

	document.getElementById('add-condition').addEventListener('click', createConditionElement);
    document.getElementById('clear-form').addEventListener('click', () => ruleForm.reset());

	conditionsContainer.addEventListener('click', (e) => {
		if (e.target.matches('.remove-condition')) {
			e.target.parentElement.remove();
		}
	});

	ruleForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const conditions = [...conditionsContainer.children].map((div) => ({
			field: div.querySelector('.condition-field').value,
			operator: div.querySelector('.condition-operator').value,
			value: div.querySelector('.condition-value').value,
		}));

		if (conditions.some(c => !c.value)) {
			alert('All condition values must be filled.');
			return;
		}

		const rule = {
			id: document.getElementById('rule-id').value || null,
			priority: parseInt(document.getElementById('rule-priority').value),
			tagsToAdd: document.getElementById('rule-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
			conditions,
		};
		await api.post('/rules', rule);
		ruleForm.reset();
        conditionsContainer.innerHTML = '';
		loadRules();
	});

	// Initial Check
	checkAuth();
});