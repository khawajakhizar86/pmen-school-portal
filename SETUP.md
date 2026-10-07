# Supabase setup

1. **Create a project** at supabase.com.
   - Authentication -> Providers -> Email: turn **off** "Allow new users to sign up" (accounts are created only by admins).
2. **Database**: SQL Editor -> paste and run `supabase/migrations/001_init.sql`.
3. **First admin**: Authentication -> Users -> Add user (Auto Confirm ON)
   - email `emp-001@staff.pmen-portal.app`, a strong password
   - then run `supabase/seed_super_admin.sql` in the SQL Editor.
4. **Edge Function** (creates/deletes users; the only code that uses the service-role key):
   ```bash
   npm i -g supabase            # or use npx supabase
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy admin-users
   # optional: supabase secrets set DEFAULT_PASSWORD=pms2026
   ```
5. **Frontend**:
   ```bash
   cp .env.example .env         # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Settings -> API)
   npm install
   npm run dev
   npm run build
   ```
6. Log in as **Staff / Emp-001** with the password from step 3.

Notes
- `public/Code_Generated_Image.png` (the logo referenced by the app) was not in the uploaded zip; put it in `public/`.
- Existing localStorage demo data is not migrated automatically.
- The demo default password (`pms2026`) is only used for newly created accounts and password resets.
