import { createTransport } from "npm:nodemailer@6.9.9";

const ALLOWED_ORIGINS = ['https://document-request.vercel.app'];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

// Estimate claim date: 3-5 business days from now
function getClaimDate(): string {
  const date = new Date();
  let businessDaysAdded = 0;
  while (businessDaysAdded < 5) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) businessDaysAdded++; // skip Sunday (0) and Saturday (6)
  }
  return date.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const gmailUser     = Deno.env.get('GMAIL_USER');
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');

    if (!gmailUser || !gmailPassword) {
      throw new Error('Gmail credentials not configured.');
    }

    const body = await req.json();
    const {
      to,
      studentName,
      contactNumber,
      referenceNumber,
      documents,      // string[] of document names
      quantities,     // Record<string, number> or number[] matching documents
      totalAmount,
      paymentMethod,
    } = body;

    if (!to || !studentName || !referenceNumber || !documents?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, studentName, referenceNumber, documents' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claimDate = getClaimDate();

    // Build document rows for the table
    const documentRows = documents.map((doc: string, i: number) => {
      const qty = Array.isArray(quantities) ? (quantities[i] ?? 1) : (quantities?.[doc] ?? 1);
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 8px; font-size: 14px; color: #374151;">${doc}</td>
          <td style="padding: 10px 8px; font-size: 14px; color: #374151; text-align: center;">${qty}</td>
        </tr>`;
    }).join('');

    const paymentLabel = paymentMethod === 'cash' ? 'Cash (Pay at School)' : 'Online Payment';

    const transporter = createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPassword },
    });

    await transporter.sendMail({
      from: `PCS Document Request System <${gmailUser}>`,
      to,
      subject: `Document Request Confirmation - ${referenceNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <!-- Header -->
          <div style="background-color: #16a34a; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🎓 Pateros Catholic School</h1>
            <p style="color: #d1fae5; margin: 5px 0 0; font-size: 14px;">Document Request System</p>
          </div>

          <div style="padding: 30px;">
            <p style="color: #374151; font-size: 15px;">Dear <strong>${studentName}</strong>,</p>
            <p style="color: #374151; font-size: 15px;">
              Your document request has been successfully submitted. Please keep this email for your reference.
            </p>

            <!-- Reference Number Banner -->
            <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">Reference Number</p>
              <p style="margin: 4px 0 0; font-size: 28px; font-weight: bold; color: #16a34a; letter-spacing: 2px;">${referenceNumber}</p>
            </div>

            <!-- Student Info -->
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #111827; margin: 0 0 12px; font-size: 16px;">📋 Request Details</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #6b7280; width: 140px;">Student Name:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500;">${studentName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #6b7280;">Contact Number:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500;">${contactNumber || '—'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; color: #6b7280;">Payment Method:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500;">${paymentLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
                  <td style="padding: 8px 0; color: #16a34a; font-weight: bold; font-size: 16px;">
                    ₱${Number(totalAmount || 0).toFixed(2)}
                  </td>
                </tr>
              </table>
            </div>

            <!-- Documents Table -->
            <div style="margin: 20px 0;">
              <h3 style="color: #111827; margin: 0 0 12px; font-size: 16px;">📄 Requested Documents</h3>
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 10px 8px; text-align: left; font-size: 13px; color: #6b7280;">Document Type</th>
                    <th style="padding: 10px 8px; text-align: center; font-size: 13px; color: #6b7280;">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  ${documentRows}
                </tbody>
              </table>
            </div>

            <!-- Claim Date -->
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                📅 <strong>Estimated Claim Date:</strong> ${claimDate}
              </p>
              <p style="margin: 6px 0 0; font-size: 12px; color: #92400e;">
                Please bring this reference number and a valid ID when claiming your documents at the Registrar's Office.
              </p>
            </div>

            <p style="color: #374151; font-size: 15px;">
              If you have questions, please contact the Registrar's Office.
            </p>
            <p style="color: #374151; font-size: 15px;">
              Best regards,<br><strong>PCS Registrar's Office</strong>
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © 2026 Pateros Catholic School. All rights reserved.
            </p>
          </div>
        </div>
      `,
    });

    console.log('Request confirmation email sent to:', to);

    return new Response(
      JSON.stringify({ success: true, message: `Confirmation email sent to ${to}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Email error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});