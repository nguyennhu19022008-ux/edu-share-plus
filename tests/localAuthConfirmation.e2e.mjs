import assert from 'node:assert/strict';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mailpitUrl = 'http://127.0.0.1:54324';

assert.ok(anonKey, 'SUPABASE_ANON_KEY is required');
assert.ok(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required');

const adminHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

async function waitFor(predicate, { timeoutMs = 15_000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await predicate();
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for condition. Last value: ${JSON.stringify(lastValue)}`);
}

async function getSchoolId() {
  const { response, body } = await jsonRequest(
    `${supabaseUrl}/rest/v1/schools?code=eq.THPT_NGUYEN_DU&select=id&limit=1`,
    { headers: adminHeaders },
  );
  assert.equal(response.status, 200, `school lookup failed: ${JSON.stringify(body)}`);
  assert.equal(body.length, 1, 'expected THPT_NGUYEN_DU seed school');
  return body[0].id;
}

async function getRows(table, query) {
  const { response, body } = await jsonRequest(
    `${supabaseUrl}/rest/v1/${table}?${query}`,
    { headers: adminHeaders },
  );
  assert.equal(response.status, 200, `${table} query failed: ${JSON.stringify(body)}`);
  return body;
}

async function findConfirmationUrl(email) {
  return waitFor(async () => {
    const { response, body } = await jsonRequest(`${mailpitUrl}/api/v1/messages`);
    if (!response.ok || !Array.isArray(body?.messages)) return null;

    const summary = body.messages.find((message) =>
      Array.isArray(message.To) && message.To.some((to) => to.Address === email),
    );
    if (!summary) return null;

    const detail = await jsonRequest(`${mailpitUrl}/api/v1/message/${summary.ID}`);
    if (!detail.response.ok) return null;

    const source = `${detail.body?.HTML || ''}\n${detail.body?.Text || ''}`.replaceAll('&amp;', '&');
    const match = source.match(/https?:\/\/[^"'<>\s]+\/auth\/v1\/verify\?[^"'<>\s]+/);
    return match?.[0] || null;
  });
}

const schoolId = await getSchoolId();
const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `phase5a-${unique}@example.test`;
const password = 'EduShare5A!StrongPass';

const signup = await jsonRequest(`${supabaseUrl}/auth/v1/signup`, {
  method: 'POST',
  headers: {
    apikey: anonKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email,
    password,
    data: {
      full_name: 'Phase 5A Test Student',
      school_id: schoolId,
      class_name: '12A1',
      phone: '0900000000',
    },
  }),
});

assert.ok(signup.response.ok, `signup failed: ${JSON.stringify(signup.body)}`);
assert.ok(signup.body?.user?.id, 'signup did not return a user id');
assert.equal(signup.body.session, null, 'email-confirmation flow must not create a session before confirmation');
const userId = signup.body.user.id;

const profileBefore = await getRows(
  'profiles',
  `user_id=eq.${userId}&select=user_id,school_id,full_name,account_status`,
);
assert.equal(profileBefore.length, 1, 'profile must be provisioned at signup');
assert.equal(profileBefore[0].account_status, 'pending_review');
assert.equal(profileBefore[0].school_id, schoolId);

const reviewsBefore = await getRows(
  'account_reviews',
  `user_id=eq.${userId}&select=id,status`,
);
assert.equal(reviewsBefore.length, 0, 'review must not be queued before email confirmation');

const confirmationUrl = await findConfirmationUrl(email);
const confirmation = await fetch(confirmationUrl, { redirect: 'manual' });
assert.ok(
  [200, 302, 303, 307, 308].includes(confirmation.status),
  `unexpected confirmation response ${confirmation.status}`,
);

const confirmedUser = await waitFor(async () => {
  const { response, body } = await jsonRequest(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: adminHeaders,
  });
  if (!response.ok) return null;
  return body?.email_confirmed_at ? body : null;
});
assert.ok(confirmedUser.email_confirmed_at, 'email_confirmed_at was not set');

const reviewsAfter = await waitFor(async () => {
  const rows = await getRows(
    'account_reviews',
    `user_id=eq.${userId}&select=id,status,submission_snapshot`,
  );
  return rows.length === 1 ? rows : null;
});
assert.equal(reviewsAfter[0].status, 'pending');
assert.equal(reviewsAfter[0].submission_snapshot?.email, email);
assert.ok(reviewsAfter[0].submission_snapshot?.email_confirmed_at);

const login = await jsonRequest(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: anonKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
});
assert.ok(login.response.ok, `confirmed-user login failed: ${JSON.stringify(login.body)}`);
assert.ok(login.body?.access_token, 'confirmed login did not return an access token');
assert.equal(login.body?.user?.id, userId);

console.log('Local Auth E2E PASS: signup -> email confirmation -> review queue -> login');
