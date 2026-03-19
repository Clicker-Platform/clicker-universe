import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Clicker Platform <onboarding@resend.dev>';

export async function sendFormNotification(
    to: string,
    formTitle: string,
    submissionData: Record<string, string>,
    fieldLabels?: Record<string, string>
) {
    const rows = Object.entries(submissionData)
        .map(([key, value]) => {
            const label = fieldLabels?.[key] || key;
            return `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;width:140px;">${label}</td><td style="padding:8px 12px;color:#111827;border-bottom:1px solid #f3f4f6;">${value || '—'}</td></tr>`;
        })
        .join('');

    const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;">
            <div style="background:#0a0a0a;padding:24px 28px;border-radius:12px 12px 0 0;">
                <h2 style="margin:0;color:#f8fafc;font-size:18px;">New Submission</h2>
                <p style="margin:6px 0 0;color:#a1a1aa;font-size:13px;">${formTitle}</p>
            </div>
            <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;">${rows}</table>
            </div>
            <p style="margin:20px 0 0;color:#9ca3af;font-size:11px;text-align:center;">Sent via Clicker Platform</p>
        </div>
    `;

    await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: `New submission: ${formTitle}`,
        html,
    });
}
