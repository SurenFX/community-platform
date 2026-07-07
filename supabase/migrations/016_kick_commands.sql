-- Comandos de chat personalizados para el bot de Kick
create table public.kick_commands (
  id               uuid default gen_random_uuid() primary key,
  command          text not null unique,  -- ej: "!redes"
  response         text not null,
  cooldown_seconds int not null default 30,
  created_at       timestamptz default now()
);

-- Seed inicial con !redes
insert into public.kick_commands (command, response)
values ('!redes', '♦ Discord: https://discord.gg/ZFfMwe3JyW ♦ YouTube: https://www.youtube.com/c/SalchiNFT ♦ Kick: https://kick.com/salchinft ♦ Telegram: https://t.me/+8xZoKks2eAUxNzkx ♦ Twitter: https://twitter.com/SalchiNFT');
