import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

function toStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin  = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid session.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Must be admin or programhead
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .in('role', ['admin', 'programhead'])
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin or programhead only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    // student_type: 'alumni' | 'current' — decides which table to update
    const student_type    = toStr(body.student_type) || 'current';
    const student_id      = toStr(body.student_id);
    const first_name      = toStr(body.first_name);
    const last_name       = toStr(body.last_name);
    const middle_name     = toStr(body.middle_name);
    const contact_number  = toStr(body.contact_number);
    const grade_level     = toStr(body.grade_level);
    const section         = toStr(body.section);
    const graduation_year = toStr(body.graduation_year);

    if (!student_id) {
      return new Response(JSON.stringify({ error: 'student_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!first_name || !last_name) {
      return new Response(JSON.stringify({ error: 'first_name and last_name are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize and validate contact number
    let normalizedContact: string | null = contact_number || null;
    if (normalizedContact) {
      if (normalizedContact.startsWith('9')) normalizedContact = '0' + normalizedContact;
      if (normalizedContact.length !== 11) {
        return new Response(JSON.stringify({ error: 'Failed to save: number must be 11 digits' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Route: alumni ─────────────────────────────────────────────────────
    if (student_type === 'alumni') {
      const alumniPayload: Record<string, any> = {
        first_name,
        last_name,
        middle_name:    middle_name || null,
        contact_number: normalizedContact,
      };

      if (graduation_year) {
        const year = parseInt(graduation_year, 10);
        if (isNaN(year) || year < 1950 || year > new Date().getFullYear()) {
          return new Response(JSON.stringify({ error: 'Invalid graduation year' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        alumniPayload.graduation_year = year;
      }

      console.log('Updating alumni row with id:', student_id, alumniPayload);

      const { error: alumniUpdateError } = await supabaseAdmin
        .from('alumni')
        .update(alumniPayload)
        .eq('id', student_id);

      if (alumniUpdateError) {
        console.error('Alumni update error:', alumniUpdateError.message);
        return new Response(JSON.stringify({ error: alumniUpdateError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Alumni updated successfully.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Route: current student ────────────────────────────────────────────
    console.log('Updating student row with id:', student_id);

    const { error: updateError } = await supabaseAdmin
      .from('students')
      .update({
        first_name,
        last_name,
        middle_name:    middle_name || null,
        contact_number: normalizedContact,
        grade_level:    grade_level || null,
        section:        section     || null,
      })
      .eq('id', student_id);

    if (updateError) {
      console.error('Student update error:', updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Student updated successfully.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});