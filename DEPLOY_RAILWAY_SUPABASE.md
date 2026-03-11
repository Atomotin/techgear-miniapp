# Railway + Supabase setup

## 1. Create Supabase project

1. Open your Supabase project dashboard.
2. Go to SQL Editor.
3. Run the SQL from `supabase/schema.sql`.

## 2. Get environment variables

In Supabase project settings copy:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Important: use `service_role` only on the server. Do not expose it in frontend code.

## 3. Configure Railway

Create a new Railway project from this GitHub repo and set these variables:

```env
ADMIN_PASSWORD=your-strong-admin-password
ADMIN_SECRET=another-long-random-secret
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3000
```

Railway can run this repo without extra config because it uses:

- `package.json`
- start command: `npm start`

## 4. First boot behavior

If Supabase tables are empty, the server seeds:

- categories
- products

from `card-tovary.js`.

Orders start empty and will be written into Supabase.

## 5. Admin panel

After deploy:

- storefront: `/`
- admin: `/admin`

Login uses `ADMIN_PASSWORD`.

## 6. Local run with Supabase

Create `.env` from `.env.example`, then run:

```bash
npm start
```

If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are missing, the app falls back to local JSON files in `data/`.
