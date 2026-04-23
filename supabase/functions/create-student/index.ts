import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://document-request.vercel.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

function toStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

// Auto-generate password: LastName + last 4 digits of phone
// Example: Sadural + 6419 = Sadural6419
function generatePassword(lastName: string, contactNumber: string): string {
  const cleanedPhone = contactNumber.replace(/\D/g, '');
  const last4 = cleanedPhone.length >= 4
    ? cleanedPhone.slice(-4)
    : cleanedPhone.padStart(4, '0');
  const cleanedLastName = lastName.trim().replace(/\s+/g, '');
  return `${cleanedLastName}${last4}`;
}

const respond = (corsHeaders: Record<string, string>, body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ── Auth check ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return respond(corsHeaders, { error: 'Unauthorized: missing Bearer token' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (token.split('.').length !== 3) {
      return respond(corsHeaders, { error: 'Unauthorized: invalid token format.' }, 401);
    }

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return respond(corsHeaders, {
        error: `Unauthorized: ${authError?.message || 'Invalid or expired session.'}`,
      }, 401);
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return respond(corsHeaders, { error: 'Forbidden: admin only' }, 403);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: any;
    try {
      body = await req.json();
    } catch {
      return respond(corsHeaders, { error: 'Invalid JSON body' }, 400);
    }

    const email          = toStr(body.email).toLowerCase();
    const first_name     = toStr(body.first_name);
    const last_name      = toStr(body.last_name);
    const middle_name    = toStr(body.middle_name);
    const contact_number = toStr(body.contact_number);
    const grade_level    = toStr(body.grade_level);
    const section        = toStr(body.section);

    if (!email)          return respond(corsHeaders, { error: 'email is required' }, 400);
    if (!first_name)     return respond(corsHeaders, { error: 'first_name is required' }, 400);
    if (!last_name)      return respond(corsHeaders, { error: 'last_name is required' }, 400);
    if (!contact_number) return respond(corsHeaders, { error: 'contact_number is required for password generation' }, 400);

    // ── Check for duplicate email ─────────────────────────────────────────────
    const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const alreadyExists = existingList?.users?.some(
      (u) => u.email?.toLowerCase() === email
    );
    if (alreadyExists) {
      return respond(corsHeaders, {
        error: `A user with email "${email}" already exists. Please use a different email.`,
      }, 400);
    }

    // ── Generate password ─────────────────────────────────────────────────────
    const password = generatePassword(last_name, contact_number);
    console.log('Auto-generated password for:', email, '→', password);

    // ── Create auth user ──────────────────────────────────────────────────────
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'student',
        username: email,
        first_name,
        last_name,
        middle_name: middle_name || null,
        contact_number: contact_number || null,
        grade_level: grade_level || null,
        section: section || null,
      },
    });

    if (createError) {
      console.error('createUser error:', createError.message);
      return respond(corsHeaders, { error: createError.message }, 400);
    }

    const userId = newUser.user!.id;
    console.log('Auth user created:', userId);

    // ── Ensure user_roles row exists ──────────────────────────────────────────
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId, role: 'student' }, { onConflict: 'user_id' });

    if (roleInsertError) {
      console.error('user_roles insert error:', roleInsertError.message);
    }

    // ── Wait briefly then check if trigger already created the student row ────
    await new Promise((r) => setTimeout(r, 500));

    const { data: existingStudent } = await supabaseAdmin
      .from('students')
      .select('student_id')
      .eq('user_id', userId)
      .single();

    if (!existingStudent) {
      // Trigger didn't fire — insert the row manually
      console.log('Trigger did not create student row, inserting manually...');
      const { error: studentInsertError } = await supabaseAdmin
        .from('students')
        .insert({
          user_id: userId,
          username: email,
          first_name,
          last_name,
          middle_name: middle_name || null,
          contact_number: contact_number || null,
          grade_level: grade_level || null,
          section: section || null,
        });

      if (studentInsertError) {
        console.error('students insert error:', studentInsertError.message);
      } else {
        console.log('Student row inserted manually for:', email);
      }
    } else {
      console.log('Trigger already created student row:', existingStudent.student_id);
    }

    // ── Fetch final student_id (set by auto_generate_student_id trigger) ──────
    let studentId = existingStudent?.student_id || '';

    if (!studentId) {
      await new Promise((r) => setTimeout(r, 1500));
      const { data: studentData } = await supabaseAdmin
        .from('students')
        .select('student_id')
        .eq('user_id', userId)
        .single();

      studentId = studentData?.student_id || '';

      // One final retry
      if (!studentId) {
        console.log('student_id not ready yet, retrying in 1s...');
        await new Promise((r) => setTimeout(r, 1000));
        const { data: retryData } = await supabaseAdmin
          .from('students')
          .select('student_id')
          .eq('user_id', userId)
          .single();
        studentId = retryData?.student_id || '';
      }
    }

    console.log('Final student_id:', studentId || 'still empty after retry');

    // ── Send welcome email ────────────────────────────────────────────────────
    try {
      console.log('Calling send-gmail for:', email);
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-gmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
        body: JSON.stringify({
          to: email,
          studentName: `${first_name} ${last_name}`,
          email,
          password,
          studentId,
          gradeLevel: grade_level,
          section,
        }),
      });

      const emailData = await emailRes.json();
      if (!emailRes.ok) {
        console.error('Email sending failed:', JSON.stringify(emailData));
      } else {
        console.log('Welcome email sent successfully to:', email);
      }
    } catch (emailErr: any) {
      console.error('Email error (non-critical):', emailErr.message);
    }

    return respond(corsHeaders, {
      success: true,
      user_id: userId,
      student_id: studentId,
      message: `Student account created for ${first_name} ${last_name}. Welcome email sent to ${email}.`,
    });

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return respond(corsHeaders, { error: err.message || 'Internal server error' }, 500);
  }
});