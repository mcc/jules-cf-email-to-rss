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
                <div class="bg-white p-4 rounded-lg shadow-md border border-gray-200 space-y-3" data-id="${post.id}">
                    <h4 class="text-xl font-semibold text-gray-800">${post.subject}</h4>
                    <div class="text-sm text-gray-600 space-y-1">
                        <p><span class="font-medium">ID:</span> ${post.id}</p>
                        <p><span class="font-medium">Received:</span> ${new Date(post.publishedAt).toLocaleString()}</p>
                        <p>
													<span class="font-medium">Status:</span>
													<span class="px-2 py-1 text-xs font-semibold rounded-full ${
														post.isPublished
															? 'bg-green-100 text-green-700'
															: 'bg-yellow-100 text-yellow-700'
													}">
														${post.isPublished ? 'PUBLISHED' : 'DRAFT'}
													</span>
												</p>
                    </div>
                    <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                        <input type="text" class="tags-input flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm" value="${post.tags.join(', ')}">
                        <button class="save-tags bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-3 rounded-md text-sm transition duration-150">Save Tags</button>
                    </div>
                    <div class="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                        <button class="toggle-publish flex-1 ${
													post.isPublished ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'
												} text-white font-semibold py-2 px-3 rounded-md text-sm transition duration-150">${
						post.isPublished ? 'Unpublish' : 'Publish'
					}</button>
                        <button class="delete-post flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-md text-sm transition duration-150">Delete</button>
                    </div>
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
                <div class="bg-white p-4 rounded-lg shadow-md border border-gray-200 space-y-3" data-id="${rule.id}">
                    <p class="text-sm text-gray-700"><span class="font-semibold">Priority:</span> ${rule.priority}</p>
                    <p class="text-sm text-gray-700"><span class="font-semibold">Tags:</span>
											<span class="ml-1">${rule.tagsToAdd
												.map((tag) => `<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">${tag}</span>`)
												.join(' ')}</span>
										</p>
                    <div>
                        <p class="text-sm font-semibold text-gray-700 mb-1">Conditions:</p>
                        <ul class="list-disc list-inside pl-4 space-y-1">
													${rule.conditions
														.map(
															(c) =>
																`<li class="text-xs text-gray-600"><span class="font-mono bg-gray-100 p-1 rounded">${c.field}</span> ${c.operator} <span class="font-mono bg-gray-100 p-1 rounded">"${c.value}"</span></li>`,
														)
														.join('')}
												</ul>
                    </div>
                    <div class="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 pt-2">
                        <button class="edit-rule flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-3 rounded-md text-sm transition duration-150">Edit</button>
                        <button class="delete-rule flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-md text-sm transition duration-150">Delete</button>
                    </div>
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
		div.className = 'flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 p-3 bg-gray-100 rounded-md';
		div.innerHTML = `
            <select class="condition-field w-full sm:w-auto flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                <option value="from">From</option>
                <option value="to">To</option>
                <option value="subject">Subject</option>
            </select>
            <select class="condition-operator w-full sm:w-auto flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
            </select>
            <input type="text" class="condition-value w-full sm:w-auto flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Value">
            <button type="button" class="remove-condition bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-3 rounded-md text-sm transition duration-150 whitespace-nowrap">Remove</button>
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