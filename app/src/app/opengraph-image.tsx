import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const alt         = 'SalchiNeta — Comunidad'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: 'hsl(220, 20%, 8%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow blobs */}
        <div style={{
          position: 'absolute', top: '80px', left: '150px',
          width: '400px', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(circle, hsl(185, 100%, 45%, 0.25) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '80px', right: '150px',
          width: '350px', height: '250px', borderRadius: '50%',
          background: 'radial-gradient(circle, hsl(45, 100%, 55%, 0.18) 0%, transparent 70%)',
        }} />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 1 }}>
          <div style={{ fontSize: '80px', lineHeight: 1 }}>🌭</div>

          <div style={{
            fontSize: '72px',
            fontWeight: 900,
            letterSpacing: '-2px',
            background: 'linear-gradient(90deg, hsl(185, 100%, 45%), hsl(45, 100%, 55%))',
            backgroundClip: 'text',
            color: 'transparent',
          }}>
            SalchiNeta
          </div>

          <div style={{
            fontSize: '26px',
            color: 'hsl(220, 15%, 55%)',
            fontWeight: 500,
            letterSpacing: '-0.5px',
          }}>
            Ganá XP · Subí de nivel · Dominá el ranking
          </div>

          {/* Platform pills */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            {[
              { label: 'Discord',  color: '#5865F2' },
              { label: 'Twitch',   color: '#9146FF' },
              { label: 'YouTube',  color: '#FF0000' },
              { label: 'Telegram', color: '#26A5E4' },
            ].map(({ label, color }) => (
              <div key={label} style={{
                padding: '8px 20px',
                borderRadius: '999px',
                border: `1px solid ${color}40`,
                background: `${color}18`,
                color,
                fontSize: '18px',
                fontWeight: 700,
              }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
