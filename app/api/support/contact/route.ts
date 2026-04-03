import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/support/contact
 * Sends the message to SUPPORT_INBOX_EMAIL (default julien@nitron.digital) via Resend.
 * Users never see the inbox address. Set RESEND_API_KEY and a verified RESEND_FROM_EMAIL in Vercel.
 *
 * @see https://resend.com/docs — verify your domain for production; onboarding@resend.dev is for testing only.
 */

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const hp = String((body as Record<string, unknown>)._hp ?? '')
    if (hp) {
      return NextResponse.json({ ok: true })
    }

    const email = String((body as Record<string, unknown>).email ?? '')
      .trim()
      .slice(0, 320)
    const message = String((body as Record<string, unknown>).message ?? '')
      .trim()
      .slice(0, 8000)

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (message.length < 10) {
      return NextResponse.json(
        { error: 'Please add a bit more detail (at least 10 characters).' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY?.trim()
    const to = process.env.SUPPORT_INBOX_EMAIL?.trim() || 'julien@nitron.digital'
    const from =
      process.env.RESEND_FROM_EMAIL?.trim() || 'Wist Support <onboarding@resend.dev>'

    if (!apiKey) {
      console.error('[support/contact] RESEND_API_KEY is not set')
      return NextResponse.json(
        { error: 'Support email is not configured yet. Please try again later.' },
        { status: 503 }
      )
    }

    const html = `
      <p><strong>Reply-To</strong> is set to the user — you can reply directly from your mail client.</p>
      <p><strong>From address (user):</strong> ${escapeHtml(email)}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
      <p style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">${escapeHtml(
        message
      )}</p>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `[Wist] Support message from ${email}`,
        html,
      }),
    })

    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) {
      console.error('[support/contact] Resend:', res.status, data)
      return NextResponse.json(
        { error: 'Could not send your message. Please try again in a moment.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[support/contact]', e)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
