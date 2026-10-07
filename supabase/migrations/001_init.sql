-- =====================================================================
-- School Portal : initial schema, RLS, RPCs and storage
-- Run this whole file once in Supabase Dashboard -> SQL Editor.
-- It is safe to re-run (uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- =====================================================================

-- ---------- Sequences (replace client-side nextRollNo / nextRegNo / ...) ----------
create sequence if not exists public.roll_no_seq   start 1;     -- '001', '002', ...
create sequence if not exists public.reg_no_seq    start 1001;  -- '1001', '1002', ...
create sequence if not exists public.emp_no_seq    start 2;     -- 'Emp-002' ... (Emp-001 = bootstrap super admin)
create sequence if not exists public.ticket_no_seq start 1001;

-- ---------- Tables ----------
create table if not exists public.role_permissions (
  role    text primary key,
  modules text[] not null default '{}'
);

create table if not exists public.staff (
  id               uuid primary key references auth.users(id) on delete cascade,
  employee_id      text not null unique,
  name             text not null,
  role             text not null check (role in ('super_admin','it_assistant','principal','admin','teacher','faculty','coordinator','hr','accounts','procurement','dept_head')),
  designation_role text,
  designation      text,
  department       text not null default '',
  campus           text not null default '',
  email            text,
  phone            text,
  cnic             text,
  avatar_path      text,
  allowed_modules  text[],          -- NULL = inherit from role_permissions; array = per-employee override
  created_at       timestamptz not null default now()
);

create table if not exists public.students (
  id          uuid primary key references auth.users(id) on delete cascade,
  roll_no     text not null unique,
  reg_no      text not null unique,
  name        text not null,
  class_name  text not null,
  section     text not null default 'A',
  campus      text not null default '',
  avatar_path text,
  created_at  timestamptz not null default now()
);
create index if not exists students_campus_class_idx on public.students (campus, class_name);

create table if not exists public.attendance_records (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  class_name      text not null,
  attendance_date date not null,
  status          text not null,
  marked_by       uuid references public.staff(id) on delete set null,
  unique (student_id, attendance_date)
);
create index if not exists attendance_class_date_idx on public.attendance_records (class_name, attendance_date);

create table if not exists public.grades (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject    text not null,
  term       text not null,
  score      numeric not null,
  graded_on  date not null default current_date,
  unique (student_id, subject, term)
);

create table if not exists public.fee_invoices (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  month      text not null,
  amount     numeric not null check (amount >= 0),
  paid       boolean not null default false,
  due_date   date not null default current_date,
  unique (student_id, month)
);

create table if not exists public.timetable_entries (
  class_name text not null,
  day        text not null,
  period     int  not null,
  subject    text not null default '',
  teacher    text not null default '',
  primary key (class_name, day, period)
);

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  author_id   uuid references public.staff(id) on delete set null,
  author_name text not null,
  created_on  date not null default current_date
);

create table if not exists public.ticket_requests (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  quantity         int  not null check (quantity >= 5),
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at     date not null default current_date,
  approved_at      date,
  approved_by      text,
  amount_collected numeric
);

create table if not exists public.tickets (
  id         uuid primary key default gen_random_uuid(),
  ticket_no  text not null unique,
  request_id uuid not null references public.ticket_requests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  seq        int  not null,
  issued_at  date not null default current_date
);

create table if not exists public.lucky_draw_winners (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid,
  ticket_no    text,
  student_id   uuid,
  student_name text,
  class_name   text,
  section      text,
  campus       text,
  prize_name   text,
  prize_emoji  text,
  drawn_at     timestamptz not null default now(),
  drawn_by     text
);

create table if not exists public.leave_requests (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.staff(id) on delete cascade,
  employee_name    text,
  employee_code    text,
  department       text,
  campus           text,
  applicant_role   text,
  approver_role    text not null,
  leave_type       text not null,
  from_date        date not null,
  to_date          date not null check (to_date >= from_date),
  reason           text not null,
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  applied_on       date not null default current_date,
  reviewed_on      date,
  reviewed_by      text,
  reviewer_remarks text not null default ''
);

-- ---------- Default module permissions (copied from the app) ----------
insert into public.role_permissions (role, modules) values
 ('super_admin',  '{dashboard,profile,attendance,grades,fees,timetable,announcements,tickets,leaves,add_employee,access_control,password}'),
 ('principal',    '{dashboard,profile,attendance,grades,fees,timetable,announcements,tickets,leaves,password}'),
 ('it_assistant', '{dashboard,profile,announcements,leaves,password}'),
 ('admin',        '{dashboard,profile,attendance,grades,fees,timetable,announcements,tickets,leaves,password}'),
 ('teacher',      '{dashboard,profile,attendance,grades,timetable,announcements,tickets,leaves,password}'),
 ('faculty',      '{dashboard,profile,attendance,grades,timetable,announcements,tickets,leaves,password}'),
 ('coordinator',  '{dashboard,profile,attendance,timetable,announcements,leaves,password}'),
 ('hr',           '{dashboard,profile,add_employee,announcements,leaves,password}'),
 ('accounts',     '{dashboard,profile,fees,announcements,leaves,password}'),
 ('procurement',  '{dashboard,profile,announcements,leaves,password}'),
 ('dept_head',    '{dashboard,profile,attendance,announcements,leaves,password}')
on conflict (role) do nothing;

-- ---------- Helper functions (SECURITY DEFINER so they bypass RLS safely) ----------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff where id = auth.uid()) $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from staff where id = auth.uid() $$;

create or replace function public.my_campus() returns text
language sql stable security definer set search_path = public as
$$ select campus from staff where id = auth.uid() $$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(my_role() = 'super_admin', false) $$;

-- Mirrors isCampusManager() in the app (principal/admin see only their campus).
-- Faculty/teacher/coordinator with a campus are ALSO campus-bound here (stricter than the demo,
-- where teachers could see every campus). To restore the demo behaviour, remove them from this list.
create or replace function public.is_campus_bound() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('principal','admin','teacher','faculty','coordinator') and campus <> ''
                    from staff where id = auth.uid()), false) $$;

create or replace function public.can_access_campus(c text) returns boolean
language sql stable security definer set search_path = public as
$$ select is_staff() and (not is_campus_bound() or c = my_campus()) $$;

-- Mirrors the module permission logic of the Sidebar: per-employee override, else role default.
create or replace function public.has_module(m text) returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((
     select s.role = 'super_admin' or m = any (coalesce(s.allowed_modules, rp.modules, '{}'))
     from staff s left join role_permissions rp on rp.role = s.role
     where s.id = auth.uid()), false) $$;

create or replace function public.student_campus(sid uuid) returns text
language sql stable security definer set search_path = public as
$$ select campus from students where id = sid $$;

create or replace function public.can_access_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select can_access_campus(student_campus(sid)) $$;

-- ---------- ID generators: only callable by service_role (Edge Function) ----------
create or replace function public.next_roll_no() returns text
language sql security definer set search_path = public as
$$ select lpad(nextval('roll_no_seq')::text, 3, '0') $$;
create or replace function public.next_reg_no() returns text
language sql security definer set search_path = public as
$$ select nextval('reg_no_seq')::text $$;
create or replace function public.next_emp_id() returns text
language sql security definer set search_path = public as
$$ select 'Emp-' || lpad(nextval('emp_no_seq')::text, 3, '0') $$;
revoke all on function public.next_roll_no(), public.next_reg_no(), public.next_emp_id() from public, anon, authenticated;
grant execute on function public.next_roll_no(), public.next_reg_no(), public.next_emp_id() to service_role;

-- ---------- Guard triggers (column-level rules RLS cannot express) ----------
-- auth.uid() is NULL for the SQL editor and the service role, which are allowed through.
create or replace function public.staff_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_super_admin() then return new; end if;
  if new.id <> old.id or new.employee_id <> old.employee_id or new.allowed_modules is distinct from old.allowed_modules then
    raise exception 'Not allowed to change identity or module access';
  end if;
  if new.role <> old.role and (new.role in ('super_admin','it_assistant') or old.role in ('super_admin','it_assistant')) then
    raise exception 'Only a super admin can grant or change this role';
  end if;
  if old.id = auth.uid() and new.role <> old.role then
    raise exception 'You cannot change your own role';
  end if;
  if old.id = auth.uid() and not has_module('add_employee') then
    -- ordinary staff may only change their own photo
    if (new.name, new.role, new.designation_role, new.designation, new.department, new.campus, new.email, new.phone, new.cnic)
       is distinct from (old.name, old.role, old.designation_role, old.designation, old.department, old.campus, old.email, old.phone, old.cnic) then
      raise exception 'You can only change your own photo';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists staff_guard_trg on public.staff;
create trigger staff_guard_trg before update on public.staff for each row execute function public.staff_guard();

create or replace function public.student_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.id <> old.id or new.roll_no <> old.roll_no or new.reg_no <> old.reg_no then
    raise exception 'Roll / registration numbers cannot be changed';
  end if;
  if old.id = auth.uid() and (new.name, new.class_name, new.section, new.campus) is distinct from (old.name, old.class_name, old.section, old.campus) then
    raise exception 'Students can only change their own photo';
  end if;
  return new;
end $$;
drop trigger if exists student_guard_trg on public.students;
create trigger student_guard_trg before update on public.students for each row execute function public.student_guard();

-- Fill applicant details server-side so they cannot be spoofed.
create or replace function public.leave_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare s staff%rowtype;
begin
  select * into s from staff where id = new.employee_id;
  new.employee_name := s.name; new.employee_code := s.employee_id; new.department := s.department;
  new.campus := s.campus; new.applicant_role := s.role;
  new.status := 'pending'; new.applied_on := current_date;
  new.reviewed_on := null; new.reviewed_by := null; new.reviewer_remarks := '';
  return new;
end $$;
drop trigger if exists leave_fill_trg on public.leave_requests;
create trigger leave_fill_trg before insert on public.leave_requests for each row execute function public.leave_fill();

-- ---------- RPCs for multi-row / privileged workflows ----------
create or replace function public.approve_ticket_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r ticket_requests%rowtype; me text;
begin
  if not (is_staff() and has_module('tickets')) then raise exception 'Not allowed'; end if;
  select * into r from ticket_requests where id = p_request for update;
  if not found or r.status <> 'pending' then raise exception 'Request is not pending'; end if;
  if not can_access_student(r.student_id) then raise exception 'Not allowed'; end if;
  select name into me from staff where id = auth.uid();
  insert into tickets (ticket_no, request_id, student_id, seq)
    select nextval('ticket_no_seq')::text, r.id, r.student_id, g from generate_series(1, r.quantity) g;
  update ticket_requests
     set status = 'approved', approved_at = current_date, approved_by = me,
         amount_collected = r.quantity * 300          -- Rs. 300 per ticket (TICKET_PRICE_PER_UNIT)
   where id = r.id;
end $$;

create or replace function public.reject_ticket_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r ticket_requests%rowtype; me text;
begin
  if not (is_staff() and has_module('tickets')) then raise exception 'Not allowed'; end if;
  select * into r from ticket_requests where id = p_request for update;
  if not found or r.status <> 'pending' then raise exception 'Request is not pending'; end if;
  if not can_access_student(r.student_id) then raise exception 'Not allowed'; end if;
  select name into me from staff where id = auth.uid();
  update ticket_requests set status = 'rejected', approved_at = current_date, approved_by = me where id = r.id;
end $$;

create or replace function public.review_leave(p_id uuid, p_status text, p_remarks text) returns void
language plpgsql security definer set search_path = public as $$
declare l leave_requests%rowtype; me text;
begin
  if p_status not in ('approved','rejected') then raise exception 'Bad status'; end if;
  select * into l from leave_requests where id = p_id for update;
  if not found or l.status <> 'pending' then raise exception 'Request is not pending'; end if;
  if not (is_staff() and has_module('leaves')
          and (my_role() = 'super_admin' or (my_role() = l.approver_role and can_access_campus(l.campus)))
          and l.employee_id <> auth.uid()) then
    raise exception 'Not allowed';
  end if;
  select name into me from staff where id = auth.uid();
  update leave_requests set status = p_status, reviewed_on = current_date, reviewed_by = me,
         reviewer_remarks = coalesce(p_remarks, '') where id = p_id;
end $$;

-- Dashboard numbers that staff may see even without access to the underlying tables.
create or replace function public.dashboard_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'faculty', (select count(*) from staff where can_access_campus(campus)),
    'unpaid',  (select count(*) from fee_invoices f where not f.paid and can_access_student(f.student_id))
  ) where is_staff()
$$;

grant execute on function public.approve_ticket_request(uuid), public.reject_ticket_request(uuid),
  public.review_leave(uuid,text,text), public.dashboard_stats() to authenticated;

-- ---------- Row Level Security ----------
alter table public.role_permissions   enable row level security;
alter table public.staff              enable row level security;
alter table public.students           enable row level security;
alter table public.attendance_records enable row level security;
alter table public.grades             enable row level security;
alter table public.fee_invoices       enable row level security;
alter table public.timetable_entries  enable row level security;
alter table public.announcements      enable row level security;
alter table public.ticket_requests    enable row level security;
alter table public.tickets            enable row level security;
alter table public.lucky_draw_winners enable row level security;
alter table public.leave_requests     enable row level security;

-- role_permissions: everyone signed in can read, only super admin can change
drop policy if exists rp_read  on public.role_permissions;
drop policy if exists rp_write on public.role_permissions;
create policy rp_read  on public.role_permissions for select to authenticated using (true);
create policy rp_write on public.role_permissions for all    to authenticated using (is_super_admin()) with check (is_super_admin());

-- staff (INSERT / DELETE only through the admin-users Edge Function => no policy for them)
drop policy if exists staff_read   on public.staff;
drop policy if exists staff_update on public.staff;
create policy staff_read on public.staff for select to authenticated
  using (id = auth.uid() or (is_staff() and (has_module('add_employee') or has_module('access_control')) and (is_super_admin() or can_access_campus(campus))));
create policy staff_update on public.staff for update to authenticated
  using (id = auth.uid() or is_super_admin() or (has_module('add_employee') and can_access_campus(campus)))
  with check (id = auth.uid() or is_super_admin() or (has_module('add_employee') and can_access_campus(campus)));

-- students
drop policy if exists students_read   on public.students;
drop policy if exists students_update on public.students;
create policy students_read on public.students for select to authenticated
  using (id = auth.uid() or can_access_campus(campus));
create policy students_update on public.students for update to authenticated
  using (id = auth.uid() or (has_module('add_employee') and can_access_campus(campus)))
  with check (id = auth.uid() or (has_module('add_employee') and can_access_campus(campus)));

-- attendance
drop policy if exists att_read  on public.attendance_records;
drop policy if exists att_write on public.attendance_records;
create policy att_read on public.attendance_records for select to authenticated
  using (student_id = auth.uid() or (has_module('attendance') and can_access_student(student_id)));
create policy att_write on public.attendance_records for all to authenticated
  using (has_module('attendance') and can_access_student(student_id))
  with check (has_module('attendance') and can_access_student(student_id));

-- grades
drop policy if exists grades_read  on public.grades;
drop policy if exists grades_write on public.grades;
create policy grades_read on public.grades for select to authenticated
  using (student_id = auth.uid() or (has_module('grades') and can_access_student(student_id)));
create policy grades_write on public.grades for all to authenticated
  using (has_module('grades') and can_access_student(student_id))
  with check (has_module('grades') and can_access_student(student_id));

-- fees
drop policy if exists fees_read  on public.fee_invoices;
drop policy if exists fees_write on public.fee_invoices;
create policy fees_read on public.fee_invoices for select to authenticated
  using (student_id = auth.uid() or (has_module('fees') and can_access_student(student_id)));
create policy fees_write on public.fee_invoices for all to authenticated
  using (has_module('fees') and can_access_student(student_id))
  with check (has_module('fees') and can_access_student(student_id));

-- timetable (global, as in the demo)
drop policy if exists tt_read  on public.timetable_entries;
drop policy if exists tt_write on public.timetable_entries;
create policy tt_read  on public.timetable_entries for select to authenticated using (true);
create policy tt_write on public.timetable_entries for all    to authenticated
  using (is_staff() and has_module('timetable')) with check (is_staff() and has_module('timetable'));

-- announcements
drop policy if exists ann_read   on public.announcements;
drop policy if exists ann_insert on public.announcements;
drop policy if exists ann_delete on public.announcements;
create policy ann_read   on public.announcements for select to authenticated using (true);
create policy ann_insert on public.announcements for insert to authenticated
  with check (is_staff() and has_module('announcements') and author_id = auth.uid());
create policy ann_delete on public.announcements for delete to authenticated
  using (is_staff() and has_module('announcements'));

-- ticket requests & tickets (approval goes through RPCs)
drop policy if exists tr_read   on public.ticket_requests;
drop policy if exists tr_insert on public.ticket_requests;
create policy tr_read on public.ticket_requests for select to authenticated
  using (student_id = auth.uid() or (has_module('tickets') and can_access_student(student_id)));
create policy tr_insert on public.ticket_requests for insert to authenticated
  with check (student_id = auth.uid() and status = 'pending' and approved_by is null and amount_collected is null
              and not exists (select 1 from ticket_requests x where x.student_id = auth.uid() and x.status = 'pending'));

drop policy if exists tk_read on public.tickets;
create policy tk_read on public.tickets for select to authenticated
  using (student_id = auth.uid() or (has_module('tickets') and can_access_student(student_id)));

-- lucky draw: everyone signed in may read winners, only super admin may draw / reset
drop policy if exists ld_read  on public.lucky_draw_winners;
drop policy if exists ld_write on public.lucky_draw_winners;
create policy ld_read  on public.lucky_draw_winners for select to authenticated using (true);
create policy ld_write on public.lucky_draw_winners for all    to authenticated using (is_super_admin()) with check (is_super_admin());

-- leave requests (review goes through review_leave())
drop policy if exists lv_read   on public.leave_requests;
drop policy if exists lv_insert on public.leave_requests;
create policy lv_read on public.leave_requests for select to authenticated
  using (employee_id = auth.uid()
         or (is_staff() and has_module('leaves') and (is_super_admin() or (my_role() = approver_role and can_access_campus(campus)))));
create policy lv_insert on public.leave_requests for insert to authenticated
  with check (employee_id = auth.uid() and has_module('leaves'));

-- ---------- Storage: private avatar bucket, one folder per user ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists avatars_select on storage.objects;
drop policy if exists avatars_insert on storage.objects;
drop policy if exists avatars_update on storage.objects;
drop policy if exists avatars_delete on storage.objects;
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
