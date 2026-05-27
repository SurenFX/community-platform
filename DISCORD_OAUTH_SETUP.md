# Configurar Discord OAuth — guía paso a paso

## 1. Crear aplicación en Discord Developer Portal

1. Ir a https://discord.com/developers/applications
2. Click en **New Application**
3. Nombre: `Community Platform` (o el nombre de tu comunidad)
4. Click **Create**

## 2. Configurar OAuth2

En el panel de tu aplicación:

1. Ir a **OAuth2** en el menú lateral
2. En **Redirects**, click **Add Redirect** y agregar:
   ```
   https://TU_PROJECT_ID.supabase.co/auth/v1/callback
   ```
   (También agregar `http://localhost:3000/auth/callback` para desarrollo local)

3. Copiar el **Client ID** y el **Client Secret** (click en "Reset Secret" si no lo ves)

## 3. Configurar en Supabase

1. Ir a tu proyecto en supabase.com
2. **Authentication** → **Providers** → buscar **Discord**
3. Toggle para activarlo
4. Pegar el **Client ID** y **Client Secret** de Discord
5. El **Callback URL** que muestra Supabase es el que pusiste en el paso 2
6. Click **Save**

## 4. Variables de entorno

En el archivo `app/.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # Settings → API → anon public
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # Settings → API → service_role
```

## 5. Verificar que funciona

1. Correr `cd app && npm run dev`
2. Abrir http://localhost:3000
3. Click en "Continuar con Discord"
4. Debería redirigir a Discord, pedir permisos, y volver al dashboard

## 6. Verificar en Supabase que se creó el usuario

En Supabase → **Authentication** → **Users**
Deberías ver tu usuario con provider = "discord"

Y en **SQL Editor**:
```sql
select id, discord_tag, username, created_at
from public.profiles
order by created_at desc
limit 5;
```

## Troubleshooting

**Error: "redirect_uri_mismatch"**
→ La URL en Discord Developer Portal no coincide con la de Supabase.
  Verificar que copiaste exactamente la URL de Supabase.

**Perfil no se crea**
→ El trigger falló. El callback tiene un fallback manual.
  Verificar en SQL Editor:
  ```sql
  select * from public.profiles;
  ```

**"Invalid OAuth state"**
→ Las cookies no se están seteando. Verificar que el middleware.ts
  está en `app/src/middleware.ts` (no en `app/middleware.ts`).
