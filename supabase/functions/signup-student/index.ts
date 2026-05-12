import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createTransport } from 'npm:nodemailer@6.9.9';

const ALLOWED_ORIGINS = [
  'https://document-request.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request) {
  const origin  = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type':                 'application/json',
  };
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function toStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: corsHeaders,
    });
  }

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: corsHeaders });

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Parse body ────────────────────────────────────────────────────────
    let body: any;
    try { body = await req.json(); }
    catch { return respond({ error: 'Invalid JSON body' }, 400); }

    // ── Account fields ────────────────────────────────────────────────────
    const email          = toStr(body.email).toLowerCase();
    const password       = toStr(body.password);
    const first_name     = toStr(body.first_name);
    const last_name      = toStr(body.last_name);
    const contact_number = toStr(body.contact_number);

    // ── Student verification fields (sent from VerifyStudent.tsx) ─────────
    // student_type    : 'current' | 'alumni'  — decides which table to write
    // student_id      : school-issued text ID  — students.student_id / alumni.student_id
    // year_level      : e.g. "Grade 11"        — students.grade_level  (current only)
    // section         : e.g. "St. Thomas"      — students.section      (current only)
    // graduation_year : e.g. "2023"            — alumni.graduation_year (alumni only)
    const student_type    = toStr(body.student_type);
    const student_id      = toStr(body.student_id);
    const year_level      = toStr(body.year_level);
    const section         = toStr(body.section);
    const graduation_year = toStr(body.graduation_year);

    // ── Validation ────────────────────────────────────────────────────────
    if (!email)        return respond({ error: 'email is required' }, 400);
    if (!password)     return respond({ error: 'password is required' }, 400);
    if (!first_name)   return respond({ error: 'first_name is required' }, 400);
    if (!last_name)    return respond({ error: 'last_name is required' }, 400);
    if (!student_type) return respond({ error: 'student_type is required' }, 400);
    if (student_type !== 'current' && student_type !== 'alumni') {
      return respond({ error: 'student_type must be "current" or "alumni"' }, 400);
    }

    console.log('signup-student called →', {
      email, student_type, student_id, year_level, section, graduation_year,
    });

    // ── Check for duplicate email ─────────────────────────────────────────
    const { data: existingList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const alreadyExists = existingList?.users?.some(
      (u) => u.email?.toLowerCase() === email
    );
    if (alreadyExists) {
      return respond({ error: 'An account with this email already exists.' }, 400);
    }

    // ── Create auth user ──────────────────────────────────────────────────
    // email_confirm: true → lets signInWithPassword work immediately after OTP
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role:           'student',
        first_name,
        last_name,
        contact_number: contact_number || null,
      },
    });

    if (createError) {
      console.error('createUser error:', createError.message);
      return respond({ error: createError.message }, 400);
    }

    const userId = newUser.user!.id;
    console.log('Auth user created:', userId);

    // ── Ensure user_roles row exists ──────────────────────────────────────
    const { error: roleErr } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: 'student' }, { onConflict: 'user_id' });
    if (roleErr) console.error('user_roles upsert error:', roleErr.message);

    // ── Wait for DB trigger to fire ───────────────────────────────────────
    await new Promise((r) => setTimeout(r, 600));

    // ── Route: current student → students table ───────────────────────────
    if (student_type === 'current') {
      // Exact column names from schema:
      //   user_id, username, first_name, last_name, contact_number,
      //   student_id (text — school-issued), grade_level, section
      // DO NOT touch student_number — it is GENERATED ALWAYS AS IDENTITY
      const studentRecord: Record<string, any> = {
        user_id:        userId,
        username:       email,
        first_name,
        last_name,
        contact_number: contact_number || null,
        student_id:     student_id     || null,  // text, school-issued ID
        grade_level:    year_level     || null,  // e.g. "Grade 11"
        section:        section        || null,  // e.g. "St. Thomas"
      };

      console.log('Saving to students:', JSON.stringify(studentRecord));

      // Check if trigger already created the row
      const { data: existingRow } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingRow) {
        // Row exists — UPDATE with the verification fields
        const { error: updateErr } = await supabase
          .from('students')
          .update(studentRecord)
          .eq('user_id', userId);
        if (updateErr) console.error('students UPDATE error:', updateErr.message);
        else           console.log('students row updated ✓');
      } else {
        // No trigger row yet — INSERT fresh
        const { error: insertErr } = await supabase
          .from('students')
          .insert(studentRecord);
        if (insertErr) console.error('students INSERT error:', insertErr.message);
        else           console.log('students row inserted ✓');
      }

    // ── Route: alumni → alumni table ──────────────────────────────────────
    } else {
      // Exact column names from alumni table:
      //   user_id, username, first_name, last_name, contact_number,
      //   student_id (text — school-issued), graduation_year (integer)
      const alumniRecord: Record<string, any> = {
        user_id:         userId,
        username:        email,
        first_name,
        last_name,
        contact_number:  contact_number  || null,
        student_id:      student_id      || null,
        graduation_year: graduation_year
          ? parseInt(graduation_year, 10)
          : null,
      };

      console.log('Saving to alumni:', JSON.stringify(alumniRecord));

      const { data: existingRow } = await supabase
        .from('alumni')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingRow) {
        const { error: updateErr } = await supabase
          .from('alumni')
          .update(alumniRecord)
          .eq('user_id', userId);
        if (updateErr) console.error('alumni UPDATE error:', updateErr.message);
        else           console.log('alumni row updated ✓');
      } else {
        const { error: insertErr } = await supabase
          .from('alumni')
          .insert(alumniRecord);
        if (insertErr) console.error('alumni INSERT error:', insertErr.message);
        else           console.log('alumni row inserted ✓');
      }
    }

    // ── Generate OTP and save to otp_codes ───────────────────────────────
    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Invalidate any previous unused OTPs for this user
    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('user_id', userId)
      .eq('is_used', false);

    const { error: otpInsertError } = await supabase
      .from('otp_codes')
      .insert({
        user_id:    userId,
        email,
        otp_code:   otp,
        expires_at: expiresAt.toISOString(),
        is_used:    false,
        attempts:   0,
      });

    if (otpInsertError) {
      console.error('OTP insert error:', otpInsertError.message);
      return respond({ error: 'Account created but failed to generate OTP.' }, 500);
    }

    // ── Send OTP via Gmail ────────────────────────────────────────────────
    const gmailUser     = Deno.env.get('GMAIL_USER');
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');

    if (gmailUser && gmailPassword) {
      try {
        const transporter = createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPassword },
        });

        await transporter.sendMail({
          from:    `PCS Document Request System <${gmailUser}>`,
          to:      email,
          subject: 'Verify Your Email — PCS Document Request',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
              <div style="background: #16a34a; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">🎓 Pateros Catholic School</h1>
              </div>
              <div style="padding: 32px; background: #fff; border: 1px solid #e5e7eb;">
                <h2 style="color: #111827; margin: 0 0 8px;">Email Verification Code</h2>
                <p style="color: #6b7280; margin: 0 0 24px;">Hi <strong>${first_name}</strong>, use this code to verify your email. It expires in <strong>5 minutes</strong>.</p>
                <div style="background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                  <p style="margin: 0; font-size: 13px; color: #6b7280;">Your Verification Code</p>
                  <p style="margin: 8px 0 0; font-size: 42px; font-weight: bold; color: #16a34a; letter-spacing: 12px;">${otp}</p>
                </div>
                <p style="color: #ef4444; font-size: 13px; margin: 0;">⚠️ Never share this code with anyone.</p>
                <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">If you didn't create this account, please ignore this email.</p>
              </div>
              <div style="background: #f9fafb; padding: 16px; text-align: center; border-radius: 0 0 8px 8px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2026 Pateros Catholic School</p>
              </div>
            </div>
          `,
        });
        console.log('Verification email sent to:', email);
      } catch (emailErr: any) {
        console.error('Email send error (non-critical):', emailErr.message);
      }
    } else {
      console.warn('Gmail env vars not set — skipping email');
    }

    return respond({
      success:   true,
      userId,
      expiresAt: expiresAt.toISOString(),
      message:   'Account created. Verification code sent to your email.',
    });

  } catch (err: any) {
    console.error('signup-student unhandled error:', err);
    return respond({ error: err.message || 'Internal server error' }, 500);
  }
});