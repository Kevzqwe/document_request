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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ✅ Check Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing Bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // ✅ Reject if token is not a JWT (real JWTs have 3 dot-separated parts)
    const isJWT = token.split('.').length === 3;
    if (!isJWT) {
      return new Response(JSON.stringify({
        error: 'Unauthorized: invalid token format. Make sure you are logged in and sending your session token, not the anon key.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ Verify the token is a valid user session
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      console.error('Auth error:', authError?.message);
      return new Response(JSON.stringify({
        error: `Unauthorized: ${authError?.message || 'Invalid or expired session. Please log in again.'}`
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ Check admin role
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

    // ✅ Parse body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, password, first_name, last_name, middle_name, contact_number, grade_level, section, student_id } = body;

    // ✅ Validate required fields
    if (!email?.trim())      return new Response(JSON.stringify({ error: 'email is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!password?.trim())   return new Response(JSON.stringify({ error: 'password is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!first_name?.trim()) return new Response(JSON.stringify({ error: 'first_name is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!last_name?.trim())  return new Response(JSON.stringify({ error: 'last_name is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ✅ Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        role: 'student',
        username: email.trim().toLowerCase(),
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        middle_name: middle_name?.trim() || null,
        contact_number: contact_number?.trim() || null,
        grade_level: grade_level?.trim() || null,
        section: section?.trim() || null,
      },
    });

    if (createError) {
      console.error('createUser error:', createError.message);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ Update student_id if provided
    if (student_id?.trim() && newUser.user) {
      const { error: updateError } = await supabaseAdmin
        .from('students')
        .update({ student_id: student_id.trim() })
        .eq('user_id', newUser.user.id);

      if (updateError) {
        console.error('student_id update error:', updateError.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: newUser.user?.id,
      message: `Student account created for ${first_name} ${last_name}`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});