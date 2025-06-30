import PostalMime from 'postal-mime';

// KV Namespace for rules is BLOG_RULES_KV

/*
Rule Data Structure (stored in BLOG_RULES_KV):
{
  "id": "string (UUID)",
  "name": "string (descriptive name, e.g., 'Tech Newsletters')",
  "senderPattern": "string (case-insensitive contains)",
  "recipientPattern": "string (case-insensitive contains, e.g., target specific alias like 'newsletter@mydomain.com')",
  "titlePattern": "string (case-insensitive contains)",
  "tags": ["string"],
  "matchType": "ALL", // Currently only ALL is supported. Future: "ANY"
  "createdAt": "ISO8601_string_timestamp",
  "enabled": true // boolean to easily enable/disable rules
}

KV keys:
- "rule_<id>" -> JSON string of the rule object
- "rules_index" -> JSON string of an array of rule IDs: ["id1", "id2", ...]
*/

// Rule Management Utilities (will also be used by admin-worker)
// For now, defined here. Can be moved to a shared module.

async function getRules(kv) {
  if (!kv) {
    console.warn("BLOG_RULES_KV not bound or available.");
    return [];
  }
  const ruleIndexJson = await kv.get("rules_index");
  if (!ruleIndexJson) {
    return []; // No rules yet
  }
  const ruleIds = JSON.parse(ruleIndexJson);
  if (!ruleIds || ruleIds.length === 0) {
    return [];
  }

  const rulePromises = ruleIds.map(id => kv.get(`rule_${id}`));
  const ruleJsonStrings = await Promise.all(rulePromises);

  return ruleJsonStrings
    .filter(json => json)
    .map(json => JSON.parse(json))
    .filter(rule => rule && rule.enabled); // Only return enabled rules
}

// Placeholder for admin functions - to be fully implemented with admin worker
// For now, these help define the structure and can be used for initial seeding if needed via wrangler kv:put
async function addRule(kv, ruleData) {
  if (!kv) throw new Error("BLOG_RULES_KV not available");
  const ruleId = ruleData.id || crypto.randomUUID();
  const rule = {
    ...ruleData,
    id: ruleId,
    createdAt: new Date().toISOString(),
    enabled: ruleData.enabled !== undefined ? ruleData.enabled : true,
    matchType: ruleData.matchType || "ALL", // Default matchType
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

async function deleteRule(kv, ruleId) {
  if (!kv) throw new Error("BLOG_RULES_KV not available");
  await kv.delete(`rule_${ruleId}`);
  const indexJson = await kv.get("rules_index");
  if (indexJson) {
    let index = JSON.parse(indexJson);
    index = index.filter(id => id !== ruleId);
    await kv.put("rules_index", JSON.stringify(index));
  }
  return { success: true };
}


// Email Receiver Worker
const MAIN_DO_ID = "MAIN_EMAIL_STORE"; // Constant ID for our single email store DO

// Helper function to apply rules
function applyRulesToEmail(email, rules) {
  const appliedTags = new Set();

  const emailSubject = (email.subject || "").toLowerCase();
  const emailFrom = (email.from || "").toLowerCase();
  const emailTo = (email.to || "").toLowerCase();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    let matches = true; // Assuming matchType "ALL"

    if (rule.senderPattern) {
      if (!emailFrom.includes(rule.senderPattern.toLowerCase())) {
        matches = false;
      }
    }
    if (matches && rule.recipientPattern) {
      if (!emailTo.includes(rule.recipientPattern.toLowerCase())) {
        matches = false;
      }
    }
    if (matches && rule.titlePattern) {
      if (!emailSubject.includes(rule.titlePattern.toLowerCase())) {
        matches = false;
      }
    }

    if (matches) {
      console.log(`Rule matched: ${rule.name || rule.id}`);
      rule.tags.forEach(tag => appliedTags.add(tag));
    }
  }
  return Array.from(appliedTags);
}

export default {
  async email(message, env, ctx) {
    console.log(`Received email from: ${message.from} to: ${message.to} with Subject: ${message.subject}`);

    try {
      const parser = new PostalMime();
      const parsedEmail = await parser.parse(message.raw);

      let emailBody = "No plain text body found.";
      if (parsedEmail.text) {
        emailBody = parsedEmail.text;
      } else if (parsedEmail.html) {
        emailBody = "HTML content found (displaying raw HTML):\n" + parsedEmail.html;
      }

      console.log("Parsed email body (plain text):", emailBody.substring(0, 100) + "...");

      // Fetch rules from KV
      const rules = await getRules(env.BLOG_RULES_KV);
      console.log(`Loaded ${rules.length} enabled rules.`);

      // Prepare email data for rule application
      const preliminaryEmailData = {
        from: message.from,
        to: message.to,
        subject: parsedEmail.subject || message.subject,
      };

      // Apply rules to get tags
      const tags = applyRulesToEmail(preliminaryEmailData, rules);
      console.log("Applied tags:", tags);

      // Get the Durable Object stub
      const doId = env.EMAIL_STORE_DO.idFromName(MAIN_DO_ID);
      const doStub = env.EMAIL_STORE_DO.get(doId);

      const finalEmailData = {
        from: message.from,
        to: message.to,
        subject: parsedEmail.subject || message.subject,
        body: emailBody,
        receivedAt: new Date().toISOString(),
        tags: tags, // Add collected tags
      };

      // Store the email in the Durable Object
      const storeResponse = await doStub.addEmail(finalEmailData);
      console.log("Stored email response:", storeResponse);

      if (!storeResponse.success) {
        console.error("Failed to store email:", storeResponse.error);
      }

    } catch (error) {
      console.error("Error processing email:", error);
    }
  }
};

// Durable Object Class
export class EmailStoreDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Ensure an index exists for emails
    this.state.blockConcurrencyWhile(async () => {
      let emailIndex = await this.state.storage.get("email_index");
      if (!emailIndex) {
        await this.state.storage.put("email_index", []);
      }
    });
  }

  // Generates a unique ID
  _generateId() {
    return crypto.randomUUID();
  }

  async addEmail(emailData) {
    const emailId = this._generateId();
    const newEmail = {
      id: emailId,
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.body, // Assuming plain text body
      receivedAt: emailData.receivedAt || new Date().toISOString(),
      tags: emailData.tags || [], // For future rule engine
    };

    await this.state.storage.put(`email_${emailId}`, newEmail);

    const index = await this.state.storage.get("email_index") || [];
    index.push(emailId);
    // Store the index sorted by receivedAt descending for easier retrieval of recent emails
    // For now, just push. We can sort when retrieving or implement more complex indexing later.
    await this.state.storage.put("email_index", index);

    console.log(`EmailStoreDO: Email ${emailId} stored.`);
    return { success: true, id: emailId };
  }

  async getEmailById(id) {
    return await this.state.storage.get(`email_${id}`);
  }

  async getEmails(options = {}) { // options could include limit, offset, etc.
    const index = await this.state.storage.get("email_index") || [];
    if (!index.length) {
      return [];
    }

    // For simplicity, fetch all. In a real app, implement pagination.
    // And sort by date.
    const emailPromises = index.map(id => this.getEmailById(id));
    let emails = (await Promise.all(emailPromises)).filter(email => email != null);

    // Sort by receivedAt descending (newest first)
    emails.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

    return emails;
  }

  async deleteEmail(id) {
    const email = await this.state.storage.get(`email_${id}`);
    if (!email) {
      console.log(`EmailStoreDO: Email ${id} not found for deletion.`);
      return { success: false, error: "not_found" };
    }

    await this.state.storage.delete(`email_${id}`);

    let index = await this.state.storage.get("email_index") || [];
    index = index.filter(emailId => emailId !== id);
    await this.state.storage.put("email_index", index);

    console.log(`EmailStoreDO: Email ${id} deleted.`);
    return { success: true };
  }

  // Placeholder for updating content - might be needed for admin
  async updateEmailContent(id, newBody, newTags) {
    let email = await this.getEmailById(id);
    if (!email) {
      return { success: false, error: "not_found" };
    }
    if (newBody !== undefined) {
      email.body = newBody;
    }
    if (newTags !== undefined) {
      email.tags = newTags;
    }
    email.updatedAt = new Date().toISOString();
    await this.state.storage.put(`email_${id}`, email);
    return { success: true, email };
  }
}
