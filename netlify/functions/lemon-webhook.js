// FuneralOS — Lemon Squeezy webhook
// No external dependencies — uses native Node.js crypto + fetch (Node 18+)
// Env vars needed: LEMON_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const crypto = require('crypto');

function verifySignature(rawBody, signatureHeader, secret) {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch { return false; }
}

async function sbFetch(path, options = {}) {
  return fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {}),
    },
  });
}

async function findUserByEmail(email) {
  const res = await sbFetch(
    `/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.users?.[0] || null;
}

async function updateUserPlan(userId, plan) {
  // Fetch existing metadata so we don't overwrite office_name etc.
  const getRes = await sbFetch(`/auth/v1/admin/users/${userId}`);
  const existing = getRes.ok ? await getRes.json() : {};
  const existingMeta = existing.user_metadata || {};

  const res = await sbFetch(`/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({
      user_metadata: { ...existingMeta, plan },
    }),
  });
  return res.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const signature = event.headers['x-signature'];
  const secret = process.env.LEMON_WEBHOOK_SECRET;

  if (!secret || !signature || !verifySignature(event.body, signature, secret)) {
    console.error('Lemon webhook: signature mismatch');
    return { statusCode: 400, body: 'Webhook signature verification failed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const eventName  = payload.meta?.event_name || '';
  const attrs      = payload.data?.attributes || {};
  const email      = attrs.user_email;
  const productName = (attrs.product_name || '').toLowerCase();

  console.log(`Lemon webhook: ${eventName} for ${email}`);

  if (!email) return { statusCode: 200, body: 'no email — skipped' };

  // Determine new plan
  let plan = null;
  const activeEvents = [
    'subscription_created',
    'subscription_updated',
    'subscription_resumed',
  ];
  const cancelledEvents = [
    'subscription_cancelled',
    'subscription_expired',
    'subscription_paused',
  ];

  if (activeEvents.includes(eventName)) {
    if (productName.includes('business')) plan = 'business';
    else if (productName.includes('pro'))  plan = 'pro';
  } else if (cancelledEvents.includes(eventName)) {
    plan = 'free';
  }

  if (plan === null) {
    return { statusCode: 200, body: `event ${eventName} — no action` };
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Lemon webhook: missing Supabase env vars');
    return { statusCode: 500, body: 'Missing Supabase config' };
  }

  const user = await findUserByEmail(email);
  if (!user) {
    console.warn(`Lemon webhook: no user found for ${email}`);
    return { statusCode: 200, body: 'user not found — skipped' };
  }

  const ok = await updateUserPlan(user.id, plan);
  console.log(`Lemon webhook: set plan=${plan} for ${email} — ${ok ? 'ok' : 'failed'}`);

  return { statusCode: 200, body: ok ? 'ok' : 'supabase update failed' };
};
