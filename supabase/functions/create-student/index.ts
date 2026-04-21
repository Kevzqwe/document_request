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

// ✅ Auto-generate password: LastName + last 4 digits of phone
// Example: Sadural + 6419 = Sadural6419
function generatePassword(lastName: string, contactNumber: string): string {
  const cleanedPhone = contactNumber.replace(/\D/g, '');
  const last4 = cleanedPhone.length >= 4
    ? cleanedPhone.slice(-4)
    : cleanedPhone.padStart(4, '0');
  const cleanedLastName = lastName.trim().replace(/\s+/g, '');
  return `${cleanedLastName}${last4}`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing Bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const isJWT = token.split('.').length === 3;
    if (!isJWT) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid token format.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({
        error: `Unauthorized: ${authError?.message || 'Invalid or expired session.'}`,
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email          = toStr(body.email);
    const first_name     = toStr(body.first_name);
    const last_name      = toStr(body.last_name);
    const middle_name    = toStr(body.middle_name);
    const contact_number = toStr(body.contact_number);
    const grade_level    = toStr(body.grade_level);
    const section        = toStr(body.section);

    if (!email)      return new Response(JSON.stringify({ error: 'email is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!first_name) return new Response(JSON.stringify({ error: 'first_name is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!last_name)  return new Response(JSON.stringify({ error: 'last_name is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!contact_number) return new Response(JSON.stringify({ error: 'contact_number is required for password generation' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ✅ Auto-generate password
    const password = generatePassword(last_name, contact_number);
    console.log('Auto-generated password for:', email, '→', password);

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        role: 'student',
        username: email.toLowerCase(),
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
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ Get the auto-generated student_id after creation
    let studentId = '';
    if (newUser.user) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const { data: studentData } = await supabaseAdmin
        .from('students')
        .select('student_id')
        .eq('user_id', newUser.user.id)
        .single();
      studentId = studentData?.student_id || '';
    }

    // ✅ Send welcome email with auto-generated password
    try {
      console.log('Calling send-gmail for:', email);
      const emailRes = await fetch(
        `${supabaseUrl}/functions/v1/send-gmail`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
          },
          body: JSON.stringify({
            to: email.toLowerCase(),
            studentName: `${first_name} ${last_name}`,
            email: email.toLowerCase(),
            password: password,
            studentId: studentId,
            gradeLevel: grade_level,
            section: section,
          }),
        }
      );
      const emailData = await emailRes.json();
      if (!emailRes.ok) {
        console.error('Email sending failed:', JSON.stringify(emailData));
      } else {
        console.log('Welcome email sent successfully to:', email);
      }
    } catch (emailErr: any) {
      console.error('Email error (non-critical):', emailErr.message);
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: newUser.user?.id,
      message: `Student account created for ${first_name} ${last_name}. Welcome email sent to ${email}.`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});