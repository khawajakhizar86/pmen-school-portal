-- Run AFTER 001_init.sql and AFTER creating the first auth user.
-- 1) Dashboard -> Authentication -> Users -> "Add user" -> "Create new user"
--      Email   : emp-001@staff.pmen-portal.app      (must match AUTH_EMAIL_DOMAIN_STAFF in the app)
--      Password: choose a strong one (NOT the demo password)
--      Tick "Auto Confirm User".
-- 2) Run this script.
insert into public.staff (id, employee_id, name, role, designation, department, campus, email, phone, cnic)
select id, 'Emp-001', 'IT Super Admin', 'super_admin', 'System Administrator',
       'Information Technology', 'Peshawar Model School Boys I', 'admin@pmen.edu.pk', '0300-0000000', '17301-0000000-1'
from auth.users where email = 'emp-001@staff.pmen-portal.app'
on conflict (id) do nothing;
