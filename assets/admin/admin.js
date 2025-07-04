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
				showToast('Login successful!', 'success');
			} else {
				showToast(result.message || 'Login failed.', 'error');
				tokenInput.value = ''; // Clear the input
			}
		} catch (error) {
			console.error('Login error:', error);
			showToast('An error occurred during login.', 'error');
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
		const itemDiv = target.closest('[data-id]'); // General selector for any item with a data-id

		if (!itemDiv) return; // Exit if the click is not within an item container

		const itemId = itemDiv.dataset.id;

		// Check if the item is a post (by looking for a unique element within post items, e.g., tags-input)
		const isPostItem = !!itemDiv.querySelector('.tags-input');
		// Check if the item is a rule (by looking for a unique element, e.g., conditions list or specific button)
		const isRuleItem = !!itemDiv.querySelector('.edit-rule') || !!itemDiv.querySelector('.delete-rule');


		// Post actions
		if (isPostItem) {
			if (target.matches('.toggle-publish')) {
				// Determine current state by checking button text or some other indicator if available
				// For simplicity, let's assume the button text accurately reflects the action to be taken.
				// If button says "Unpublish", it means isPublished should be false.
				try {
					const currentPostData = await (await api.get(`/posts/${itemId}`)).json();
					const newPublishState = !currentPostData.isPublished;
					const res = await api.patch(`/posts/${itemId}`, { isPublished: newPublishState });
					if (!res.ok) throw new Error(await res.text());
					showToast(`Post ${newPublishState ? 'published' : 'unpublished'} successfully.`, 'success');
					loadPosts(); // Reload to reflect changes
				} catch (err) {
					showToast(`Error updating post: ${err.message}`, 'error');
				}
			} else if (target.matches('.save-tags')) {
				try {
					const tags = itemDiv.querySelector('.tags-input').value.split(',').map((t) => t.trim()).filter(Boolean);
					const res = await api.patch(`/posts/${itemId}`, { tags });
					if (!res.ok) throw new Error(await res.text());
					showToast('Tags saved successfully.', 'success');
					loadPosts(); // Reload to reflect changes
				} catch (err) {
					showToast(`Error saving tags: ${err.message}`, 'error');
				}
			} else if (target.matches('.delete-post')) {
				if (confirm('Are you sure you want to delete this post?')) {
					try {
						const res = await api.delete(`/posts/${itemId}`);
						if (!res.ok) throw new Error(await res.text());
						showToast('Post deleted successfully.', 'success');
						loadPosts(); // Reload to remove the item
					} catch (err) {
						showToast(`Error deleting post: ${err.message}`, 'error');
					}
				}
			}
		}

		// Rule actions
		else if (isRuleItem) { // Use else if to ensure it's not a post action
			if (target.matches('.delete-rule')) {
				if (confirm('Are you sure you want to delete this rule?')) {
					try {
						const res = await api.delete(`/rules/${itemId}`);
						if (!res.ok) throw new Error(await res.text());
						showToast('Rule deleted successfully.', 'success');
						loadRules(); // Reload to remove the item
					} catch (err) {
						showToast(`Error deleting rule: ${err.message}`, 'error');
					}
				}
			} else if (target.matches('.edit-rule')) {
				const res = await api.get('/rules'); // Fetch all rules again to get the specific one
				const rules = await res.json();
				const ruleToEdit = rules.find(r => r.id === itemId);
				if (ruleToEdit) {
					openRuleModal(ruleToEdit); // Open modal for editing
				} else {
					console.error('Rule not found for editing:', itemId);
					alert('Could not find the rule to edit.');
				}
			}
		}
	});

	// Rule form logic
	const ruleForm = document.getElementById('rule-form');
	const conditionsContainer = document.getElementById('rule-conditions');
	const ruleModal = document.getElementById('rule-modal');
	const ruleModalTitle = document.getElementById('rule-modal-title');
	const addNewRuleButton = document.getElementById('add-new-rule-button');
	const closeRuleModalButton = document.getElementById('close-rule-modal');

	function openRuleModal(rule = null) {
		ruleForm.reset();
		conditionsContainer.innerHTML = '';
		document.getElementById('rule-id').value = '';

		if (rule) {
			ruleModalTitle.textContent = 'Edit Rule';
			populateRuleForm(rule);
		} else {
			ruleModalTitle.textContent = 'Add New Rule';
			// Add one empty condition for new rules by default
			createConditionElement();
		}
		ruleModal.style.display = 'flex'; // Use flex to allow for centering defined by modal's own styles if any
	}

	function closeRuleModal() {
		ruleModal.style.display = 'none';
	}

	addNewRuleButton.addEventListener('click', () => openRuleModal());
	closeRuleModalButton.addEventListener('click', closeRuleModal);
	// Close modal if clicking outside the modal content
	ruleModal.addEventListener('click', (event) => {
		if (event.target === ruleModal) {
			closeRuleModal();
		}
	});


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
    document.getElementById('clear-form').addEventListener('click', () => {
        ruleForm.reset();
        conditionsContainer.innerHTML = '';
        document.getElementById('rule-id').value = ''; // Clear ID
        ruleModalTitle.textContent = 'Add New Rule'; // Reset title
        createConditionElement(); // Add one empty condition
    });

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
		try {
			const res = await api.post('/rules', rule);
			if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || `Server responded with ${res.status}`);
            }
			const savedRule = await res.json();
			showToast(rule.id ? 'Rule updated successfully.' : 'Rule added successfully.', 'success');
			closeRuleModal(); // Close modal after successful submission
			loadRules(); // Reload rules to show changes
		} catch (err) {
			showToast(`Error saving rule: ${err.message}`, 'error');
            // Optionally, keep the modal open if there's an error
		}
	});

	// Initial Check
	checkAuth();

	// Toast Notification Function
	function showToast(message, type = 'success', duration = 3000) {
		const container = document.getElementById('toast-container');
		const toast = document.createElement('div');
		toast.className = `toast ${type}`; // 'success' or 'error'
		toast.textContent = message;
		container.appendChild(toast);

		// Animate in
		setTimeout(() => {
			toast.classList.add('show');
		}, 10); // Small delay to ensure transition triggers

		// Animate out and remove
		setTimeout(() => {
			toast.classList.remove('show');
			setTimeout(() => {
				if (toast.parentElement === container) { // Check if still child before removing
					container.removeChild(toast);
				}
			}, 300); // Wait for fade out transition
		}, duration);
	}
});