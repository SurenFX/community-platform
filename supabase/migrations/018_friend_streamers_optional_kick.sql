-- Hace kick_slug opcional para soportar streamers solo-Twitch
alter table public.friend_streamers alter column kick_slug drop not null;
