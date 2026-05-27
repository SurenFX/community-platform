# Community Platform

Hub de engagement y reputación para comunidades de streamers.

## Stack

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Base de datos**: Supabase (PostgreSQL + Auth + Realtime)
- **Backend worker**: NestJS (paso 4)
- **Cache**: Upstash Redis (paso 4)

## Setup inicial

### 1. Clonar e instalar

```bash
cd app && npm install
```

### 2. Configurar variables de entorno

```bash
cp app/.env.local app/.env.local
# Editar con tus valores de Supabase
```

### 3. Inicializar Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU_PROJECT_ID
```

### 4. Aplicar migrations

```bash
supabase db push
```

### 5. Configurar Discord OAuth en Supabase

Panel de Supabase → Authentication → Providers → Discord → Enable
- Client ID y Secret desde: discord.com/developers/applications

### 6. Correr en desarrollo

```bash
cd app && npm run dev
```

Abrir http://localhost:3000

## Pasos del proyecto

- [x] Paso 1: Estructura + Supabase setup
- [ ] Paso 2: Schema SQL completo
- [ ] Paso 3: Auth Discord OAuth
- [ ] Paso 4: Motor de XP + worker NestJS
- [ ] Paso 5: Discord bot
- [ ] Paso 6: Realtime leaderboard
- [ ] Paso 7: Admin panel
