-- Agrega soporte de Twitch a la tabla de streamers amigos
alter table public.friend_streamers add column twitch_login text;
