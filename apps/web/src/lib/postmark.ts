type PostmarkMessage = {
  From: string;
  To: string;
  Subject: string;
  TextBody: string;
};

export async function sendPostmarkEmail(message: PostmarkMessage) {
  const token = process.env.POSTMARK_SERVER_TOKEN || '';
  if (!token) {
    // In dev/local we allow skipping; in prod we want to fail loudly.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing POSTMARK_SERVER_TOKEN');
    }
    return { ok: true, skipped: true };
  }

  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Postmark-Server-Token': token
    },
    body: JSON.stringify(message)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Postmark send failed: ${res.status} ${text}`.slice(0, 500));
  }

  return { ok: true };
}

