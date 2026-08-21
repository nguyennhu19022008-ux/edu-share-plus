import assert from 'node:assert/strict';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const mailpitUrl = 'http://127.0.0.1:54324';

assert.ok(anonKey, 'SUPABASE_ANON_KEY is required');

const anonHeaders = { apikey: anonKey };

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
    { headers: anonHeaders },
  );
  assert.equal(response.status, 200, `school lookup failed: ${JSON.stringify(body)}`);
  assert.equal(body.length, 1, 'expected THPT_NGUYEN_DU seed school');
  return body[0].id;
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

async function passwordLogin(email, password) {
  return jsonRequest(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
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

const loginBeforeConfirmation = await passwordLogin(email, password);
assert.equal(loginBeforeConfirmation.response.ok, false, 'unconfirmed email must not be able to sign in');

const confirmationUrl = await findConfirmationUrl(email);
const confirmation = await fetch(confirmationUrl, { redirect: 'manual' });
assert.ok(
  [200, 302, 303, 307, 308].includes(confirmation.status),
  `unexpected confirmation response ${confirmation.status}`,
);

const login = await waitFor(async () => {
  const result = await passwordLogin(email, password);
  return result.response.ok && result.body?.access_token ? result : null;
});
const accessToken = login.body.access_token;
assert.equal(login.body?.user?.id, userId);
assert.ok(login.body?.user?.email_confirmed_at, 'confirmed login user must contain email_confirmed_at');

const authHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${accessToken}`,
};

const context = await jsonRequest(`${supabaseUrl}/rest/v1/rpc/get_current_student_context`, {
  method: 'POST',
  headers: {
    ...authHeaders,
    'Content-Type': 'application/json',
  },
  body: '{}',
});
assert.equal(context.response.status, 200, `student context failed: ${JSON.stringify(context.body)}`);
assert.equal(context.body?.user_id, userId);
assert.equal(context.body?.school_id, schoolId);
assert.equal(context.body?.account_status, 'pending_review');

const review = await waitFor(async () => {
  const result = await jsonRequest(
    `${supabaseUrl}/rest/v1/account_reviews?user_id=eq.${userId}&select=id,status,submission_snapshot`,
    { headers: authHeaders },
  );
  if (!result.response.ok) {
    throw new Error(`account review query failed: ${result.response.status} ${JSON.stringify(result.body)}`);
  }
  return Array.isArray(result.body) && result.body.length === 1 ? result.body[0] : null;
});
assert.equal(review.status, 'pending');
assert.equal(review.submission_snapshot?.email, email);
assert.ok(review.submission_snapshot?.email_confirmed_at);

console.log('Local Auth E2E PASS: signup -> blocked pre-confirm login -> email confirmation -> review queue -> authenticated student context');
