import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'
import { getLevelTitle, getRankTier } from '@/lib/utils'

export const runtime = 'edge'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, avatar_url, bio')
    .eq('username', decodeURIComponent(username))
    .single()

  if (!profile) {
    return new Response('Not found', { status: 404 })
  }

  const { data: rep } = await admin
    .from('user_reputation')
    .select('total_xp, level, current_streak, weekly_xp, prestige_level')
    .eq('user_id', profile.id)
    .single()

  const { data: badges } = await admin
    .from('user_badges')
    .select('badge_id, badges(name, image_url, tier)')
    .eq('user_id', profile.id)
    .limit(4)

  const level     = rep?.level ?? 1
  const totalXp   = rep?.total_xp ?? 0
  const streak    = rep?.current_streak ?? 0
  const weeklyXp  = rep?.weekly_xp ?? 0
  const tier      = getRankTier(level)
  const title     = getLevelTitle(level)

  const TIER_COLORS: Record<string, string> = {
    'HIERRO':   '#94a3b8',
    'BRONCE':   '#d97706',
    'PLATA':    '#cbd5e1',
    'ORO':      '#facc15',
    'DIAMANTE': '#22d3ee',
    'MAESTRO':  '#a78bfa',
  }
  const tierColor = TIER_COLORS[tier.label] ?? '#22d3ee'

  const topBadges = (badges ?? []).slice(0, 4)

  return new ImageResponse(
    (
      <div
        style={{
          display:         'flex',
          flexDirection:   'column',
          width:           '600px',
          height:          '315px',
          background:      'linear-gradient(135deg, #0d1117 0%, #0f1923 100%)',
          borderRadius:    '16px',
          overflow:        'hidden',
          fontFamily:      'sans-serif',
          position:        'relative',
          border:          `1px solid ${tierColor}30`,
        }}
      >
        {/* Background glow */}
        <div style={{
          position:   'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: `radial-gradient(ellipse at 0% 0%, ${tierColor}18 0%, transparent 60%)`,
          display:    'flex',
        }} />

        {/* Top accent line */}
        <div style={{ height: '3px', background: `linear-gradient(90deg, ${tierColor}, transparent)`, display: 'flex' }} />

        <div style={{ display: 'flex', padding: '24px', gap: '20px', flex: 1 }}>
          {/* Left: Avatar + level */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                width={88}
                height={88}
                style={{ borderRadius: '16px', border: `3px solid ${tierColor}60` }}
              />
            ) : (
              <div style={{
                width: '88px', height: '88px', borderRadius: '16px',
                background: `${tierColor}20`, border: `3px solid ${tierColor}60`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '36px', color: tierColor, fontWeight: 900,
              }}>
                {profile.username[0].toUpperCase()}
              </div>
            )}
            {/* Level badge */}
            <div style={{
              background: `${tierColor}20`, border: `1px solid ${tierColor}50`,
              borderRadius: '8px', padding: '4px 10px',
              fontSize: '13px', fontWeight: 900, color: tierColor,
              display: 'flex',
            }}>
              NV. {level}
            </div>
          </div>

          {/* Right: Info */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
            {/* Name + tier */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '26px', fontWeight: 900, color: '#f8fafc' }}>
                {profile.username}
              </span>
              <span style={{
                background: `${tierColor}25`, border: `1px solid ${tierColor}50`,
                borderRadius: '6px', padding: '3px 10px',
                fontSize: '10px', fontWeight: 900, color: tierColor,
                letterSpacing: '2px', display: 'flex',
              }}>
                {tier.label.toUpperCase()}
              </span>
            </div>

            {/* Title */}
            <span style={{ fontSize: '14px', color: tierColor, fontWeight: 700 }}>{title}</span>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              {[
                { label: 'XP Total',  value: totalXp.toLocaleString('es-AR') },
                { label: 'XP Semana', value: weeklyXp.toLocaleString('es-AR') },
                { label: 'Racha',     value: `${streak}d` },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: '#ffffff08', borderRadius: '10px', padding: '8px 14px',
                  border: '1px solid #ffffff10',
                }}>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#f8fafc' }}>{value}</span>
                  <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 600, letterSpacing: '1px' }}>{label.toUpperCase()}</span>
                </div>
              ))}
            </div>

            {/* Badges */}
            {topBadges.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '1px' }}>LOGROS:</span>
                {topBadges.map((b: any, i: number) => (
                  <span key={i} style={{
                    fontSize: '22px',
                    filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.4))',
                    display: 'flex',
                  }}>
                    {b.badges?.image_url ?? ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 24px', borderTop: '1px solid #ffffff10',
          background: '#ffffff05',
        }}>
          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>salchinet.com</span>
          <span style={{ fontSize: '11px', color: '#475569' }}>Comunidad de SalchiNeta</span>
        </div>
      </div>
    ),
    {
      width:  600,
      height: 315,
    }
  )
}
