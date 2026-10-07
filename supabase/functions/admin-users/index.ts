// Supabase Edge Function: admin-users
// The ONLY place the service-role key is used. It runs on Supabase's servers (never in the browser).
// Deploy:  supabase functions deploy admin-users
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//          Optional:  supabase secrets set DEFAULT_PASSWORD=... AUTH_EMAIL_DOMAIN_STAFF=... AUTH_EMAIL_DOMAIN_STUDENT=...
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const STAFF_DOMAIN = Deno.env.get('AUTH_EMAIL_DOMAIN_STAFF') ?? 'staff.pmen-portal.app';
const STUDENT_DOMAIN = Deno.env.get('AUTH_EMAIL_DOMAIN_STUDENT') ?? 'students.pmen-portal.app';
const DEFAULT_PASSWORD = Deno.env.get('DEFAULT_PASSWORD') ?? 'pms2026';
const ROLES = ['super_admin','it_assistant','principal','admin','teacher','faculty','coordinator','hr','accounts','procurement','dept_head'];
const CAMPUS_BOUND = ['principal','admin','teacher','faculty','coordinator'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    const { data: u } = await caller.auth.getUser();
    if (!u?.user) return json({ error: 'Not signed in' }, 401);

    // Who is calling, and may they manage people?
    const { data: me } = await admin.from('staff').select('*').eq('id', u.user.id).maybeSingle();
    if (!me) return json({ error: 'Staff access required' }, 403);
    let modules: string[] = me.allowed_modules;
    if (!modules) {
      const { data: rp } = await admin.from('role_permissions').select('modules').eq('role', me.role).maybeSingle();
      modules = rp?.modules ?? [];
    }
    const isSuper = me.role === 'super_admin';
    if (!isSuper && !modules.includes('add_employee')) return json({ error: 'Not allowed' }, 403);
    const bound = CAMPUS_BOUND.includes(me.role) && me.campus !== '';

    const body = await req.json();
    const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

    if (body.action === 'create_staff') {
      const role = clean(body.role);
      if (!ROLES.includes(role)) return json({ error: 'Invalid role' }, 400);
      if (!isSuper && ['super_admin', 'it_assistant'].includes(role)) return json({ error: 'Only a super admin can create this role' }, 403);
      const name = clean(body.name);
      if (!name) return json({ error: 'Name is required' }, 400);
      const campus = bound ? me.campus : clean(body.campus);

      const { data: empId, error: e1 } = await admin.rpc('next_emp_id');
      if (e1) return json({ error: e1.message }, 500);
      const { data: created, error: e2 } = await admin.auth.admin.createUser({
        email: `${String(empId).toLowerCase()}@${STAFF_DOMAIN}`,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });
      if (e2 || !created.user) return json({ error: e2?.message ?? 'Could not create user' }, 500);
      const { error: e3 } = await admin.from('staff').insert({
        id: created.user.id, employee_id: empId, name, role,
        designation_role: clean(body.designationRole) || null, designation: clean(body.designationRole) || null,
        department: clean(body.department), campus,
        email: clean(body.email) || null, phone: clean(body.phone) || null, cnic: clean(body.cnic) || null,
      });
      if (e3) { await admin.auth.admin.deleteUser(created.user.id); return json({ error: e3.message }, 500); }
      return json({ id: created.user.id, employeeId: empId });
    }

    if (body.action === 'create_student') {
      const name = clean(body.name);
      if (!name) return json({ error: 'Name is required' }, 400);
      const campus = bound ? me.campus : clean(body.campus);
      const { data: roll } = await admin.rpc('next_roll_no');
      const { data: reg } = await admin.rpc('next_reg_no');
      const { data: created, error: e2 } = await admin.auth.admin.createUser({
        email: `roll-${roll}@${STUDENT_DOMAIN}`, password: DEFAULT_PASSWORD, email_confirm: true,
      });
      if (e2 || !created.user) return json({ error: e2?.message ?? 'Could not create user' }, 500);
      const { error: e3 } = await admin.from('students').insert({
        id: created.user.id, roll_no: roll, reg_no: reg, name,
        class_name: clean(body.className), section: clean(body.section) || 'A', campus,
      });
      if (e3) { await admin.auth.admin.deleteUser(created.user.id); return json({ error: e3.message }, 500); }
      return json({ id: created.user.id, rollNo: roll, regNo: reg });
    }

    if (body.action === 'delete_user' || body.action === 'reset_password') {
      const kind = body.kind === 'student' ? 'students' : 'staff';
      const id = clean(body.id);
      const { data: target } = await admin.from(kind).select('*').eq('id', id).maybeSingle();
      if (!target) return json({ error: 'Not found' }, 404);
      if (bound && target.campus !== me.campus) return json({ error: 'Not allowed' }, 403);
      if (kind === 'staff') {
        if (target.id === me.id) return json({ error: 'You cannot modify your own account here' }, 400);
        if (!isSuper && ['super_admin', 'it_assistant'].includes(target.role)) return json({ error: 'Not allowed' }, 403);
      }
      if (body.action === 'delete_user') {
        const { error } = await admin.auth.admin.deleteUser(id); // cascades to staff/students and their data
        if (error) return json({ error: error.message }, 500);
      } else {
        const { error } = await admin.auth.admin.updateUserById(id, { password: DEFAULT_PASSWORD });
        if (error) return json({ error: error.message }, 500);
      }
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
