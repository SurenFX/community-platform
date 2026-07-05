-- Streamers amigos de la comunidad (para anunciar en Discord cuando encienden en Kick)
create table public.friend_streamers (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  kick_slug  text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz default now()
);

alter table public.friend_streamers enable row level security;

create policy "Admins manage friend_streamers" on public.friend_streamers
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
