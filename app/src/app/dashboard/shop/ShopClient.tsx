'use client'

import { useState, useTransition } from 'react'
import { CircleDollarSign, Loader2, Check, ShoppingBag, User } from 'lucide-react'
import { purchaseItem, equipItem, unequipItem } from '@/app/actions/shop'
import { getLevelTitle } from '@/lib/utils'

const RARITY_STYLES: Record<string, { border: string; badge: string; glow?: string }> = {
  COMMON:    { border: 'border-border',          badge: 'bg-secondary text-muted-foreground'              },
  RARE:      { border: 'border-blue-400/30',     badge: 'bg-blue-400/15 text-blue-400'                   },
  EPIC:      { border: 'border-purple-400/30',   badge: 'bg-purple-400/15 text-purple-400'               },
  LEGENDARY: { border: 'border-yellow-400/40',   badge: 'bg-yellow-400/15 text-yellow-500', glow: '0 0 20px hsl(45 100% 55% / 0.2)' },
}

const BORDER_COLOR_HEX: Record<string, string> = {
  'cyan-400':   '#22d3ee',
  'green-400':  '#4ade80',
  'violet-400': '#a78bfa',
  'red-500':    '#ef4444',
  'pink-400':   '#f472b6',
  'yellow-400': '#facc15',
  'orange-400': '#fb923c',
  'purple-500': '#a855f7',
}

type Tab = 'BORDER_COLOR' | 'NAME_EMOJI' | 'CUSTOM_TITLE' | 'BOOST'

interface ShopItem {
  id: string; name: string; description: string
  type: string; value: string; price_sc: number
  rarity: string; sort_order: number
  boost_type?: string | null; boost_value?: number | null; boost_duration_hours?: number | null
}

interface ActiveBoost {
  id: string; boost_type: string; boost_value: number; expires_at: string
}

interface Props {
  items:          ShopItem[]
  balance:        number
  inventoryIds:   string[]
  equippedBorder: string | null
  equippedEmoji:  string | null
  equippedTitle:  string | null
  username:       string
  avatarUrl:      string | null
  activeBoosts:   ActiveBoost[]
}

export default function ShopClient({
  items, balance: initialBalance,
  inventoryIds: initialInv,
  equippedBorder: initBorder,
  equippedEmoji: initEmoji,
  equippedTitle: initTitle,
  username, avatarUrl, activeBoosts: initialBoosts,
}: Props) {
  const [tab,        setTab]        = useState<Tab>('BORDER_COLOR')
  const [balance,    setBalance]    = useState(initialBalance)
  const [inv,        setInv]        = useState(new Set(initialInv))
  const [border,     setBorder]     = useState(initBorder)
  const [emoji,      setEmoji]      = useState(initEmoji)
  const [title,      setTitle]      = useState(initTitle)
  const [actionId,   setActionId]   = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [previewItem, setPreviewItem] = useState<ShopItem | null>(null)
  const [isPending, start]          = useTransition()
  const [activeBoosts, setActiveBoosts] = useState<ActiveBoost[]>(initialBoosts)

  const tabItems = items.filter(i => i.type === tab).sort((a, b) => a.sort_order - b.sort_order)

  // Preview values (hovered item overrides equipped)
  const previewBorder = previewItem?.type === 'BORDER_COLOR' ? previewItem.value : border
  const previewEmoji  = previewItem?.type === 'NAME_EMOJI'   ? previewItem.value : emoji
  const previewTitle  = previewItem?.type === 'CUSTOM_TITLE' ? previewItem.value : title
  const previewBorderHex = BORDER_COLOR_HEX[previewBorder ?? '']

  function getEquipped(item: ShopItem) {
    if (item.type === 'BORDER_COLOR') return border === item.value
    if (item.type === 'NAME_EMOJI')   return emoji === item.value
    if (item.type === 'CUSTOM_TITLE') return title === item.value
    return false
  }

  function handleBuy(item: ShopItem) {
    setError(null); setActionId(item.id)
    start(async () => {
      const r = await purchaseItem(item.id)
      if (r.error) { setError(r.error) }
      else {
        setBalance(b => b - item.price_sc)
        if (item.boost_type) {
          // Boost consumible: mostrar en lista de activos optimisticamente
          const hours = item.boost_duration_hours ?? 1
          const fake: ActiveBoost = {
            id: Date.now().toString(),
            boost_type: item.boost_type,
            boost_value: item.boost_value ?? 1,
            expires_at: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
          }
          setActiveBoosts(prev => [...prev, fake])
        } else {
          setInv(prev => new Set([...prev, item.id]))
        }
      }
      setActionId(null)
    })
  }

  function handleEquip(item: ShopItem) {
    setError(null)
    const isEquipped = getEquipped(item)
    setActionId(item.id)
    start(async () => {
      const r = isEquipped ? await unequipItem(item.type) : await equipItem(item.id, item.type)
      if (r.error) setError(r.error)
      else {
        if (item.type === 'BORDER_COLOR') setBorder(isEquipped ? null : item.value)
        if (item.type === 'NAME_EMOJI')   setEmoji(isEquipped ? null : item.value)
        if (item.type === 'CUSTOM_TITLE') setTitle(isEquipped ? null : item.value)
      }
      setActionId(null)
    })
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'BORDER_COLOR',  label: 'Marcos',   icon: '🖼️' },
    { key: 'NAME_EMOJI',    label: 'Emojis',   icon: '✨' },
    { key: 'CUSTOM_TITLE',  label: 'Títulos',  icon: '📛' },
    { key: 'BOOST',         label: 'Boosts',   icon: '⚡' },
  ]

  return (
    <div className="space-y-6">
      {/* Header con balance */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tienda</h1>
          <p className="text-muted-foreground text-sm mt-1">Personalizá tu perfil con SalchiCoins</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5">
          <CircleDollarSign className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-foreground">{balance.toLocaleString('es-AR')}</span>
          <span className="text-xs text-muted-foreground">SC</span>
        </div>
      </div>

      {/* Preview panel */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
        <div className="shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username}
              className="w-14 h-14 rounded-full"
              style={previewBorderHex
                ? { border: `3px solid ${previewBorderHex}`, boxShadow: `0 0 16px ${previewBorderHex}50` }
                : { border: '2px solid hsl(var(--border))' }}
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center"
              style={previewBorderHex
                ? { border: `3px solid ${previewBorderHex}`, boxShadow: `0 0 16px ${previewBorderHex}50` }
                : { border: '2px solid hsl(var(--border))' }}
            >
              <User className="w-6 h-6 text-primary" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">
            {previewEmoji && <span className="mr-1">{previewEmoji}</span>}
            {username}
          </p>
          <p className="text-xs text-primary font-medium mt-0.5">
            {previewTitle ?? getLevelTitle(1)}
          </p>
          {previewItem ? (
            <p className="text-[11px] text-muted-foreground mt-1">
              Previsualizando: <span className="text-foreground font-medium">{previewItem.name}</span>
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-1">Pasá el cursor sobre un item para previsualizar</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {activeBoosts.filter(b => new Date(b.expires_at) > new Date()).length > 0 && (
        <div className="flex flex-wrap gap-2 items-center bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
          <span className="text-xs font-bold text-yellow-400 mr-1">BOOSTS ACTIVOS:</span>
          {activeBoosts.filter(b => new Date(b.expires_at) > new Date()).map(b => {
            const mins = Math.round((new Date(b.expires_at).getTime() - Date.now()) / 60000)
            const timeLeft = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`
            return (
              <span key={b.id} className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/25 text-yellow-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                ⚡ x{b.boost_value} XP — {timeLeft}
              </span>
            )
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPreviewItem(null) }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === t.key ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {tabItems.map(item => {
          const owned    = inv.has(item.id)
          const equipped = getEquipped(item)
          const loading  = actionId === item.id && isPending
          const rarity   = RARITY_STYLES[item.rarity] ?? RARITY_STYLES.COMMON
          const canAfford = balance >= item.price_sc
          const isPreviewing = previewItem?.id === item.id

          return (
            <div
              key={item.id}
              onMouseEnter={() => setPreviewItem(item)}
              onMouseLeave={() => setPreviewItem(null)}
              className={`relative flex flex-col bg-card border rounded-2xl p-4 transition-all cursor-default ${rarity.border} ${
                equipped ? 'ring-2 ring-primary/50' : ''
              } ${isPreviewing ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}
              style={rarity.glow ? { boxShadow: rarity.glow } : undefined}
            >
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full self-start mb-3 ${rarity.badge}`}>
                {item.rarity}
              </span>

              {/* Preview estática del item */}
              <div className="flex items-center justify-center h-14 mb-3">
                {item.type === 'BORDER_COLOR' && (
                  <div
                    className="w-10 h-10 rounded-full bg-secondary"
                    style={{
                      border:     `3px solid ${BORDER_COLOR_HEX[item.value] ?? '#888'}`,
                      boxShadow:  `0 0 12px ${BORDER_COLOR_HEX[item.value] ?? '#888'}40`,
                    }}
                  />
                )}
                {item.type === 'NAME_EMOJI' && <span className="text-3xl">{item.value}</span>}
                {item.type === 'CUSTOM_TITLE' && (
                  <span className="text-xs font-bold text-center text-foreground px-1">{item.value}</span>
                )}
                {item.type === 'BOOST' && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-3xl">{item.boost_value && item.boost_value >= 4 ? '⚡' : item.boost_value && item.boost_value >= 2 ? '🔥' : '✨'}</span>
                    <span className="text-[10px] font-bold text-yellow-400">x{item.boost_value} XP</span>
                    <span className="text-[9px] text-muted-foreground">{item.boost_duration_hours}h</span>
                  </div>
                )}
              </div>

              <p className="text-xs font-semibold text-foreground mb-0.5 truncate">{item.name}</p>
              <p className="text-[11px] text-muted-foreground mb-3 flex-1 line-clamp-2">{item.description}</p>

              {item.type === 'BOOST' ? (
                <button onClick={() => handleBuy(item)} disabled={loading || !canAfford}
                  className="w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <><CircleDollarSign className="w-3 h-3" />{item.price_sc} SC — Activar</>}
                </button>
              ) : owned ? (
                <button onClick={() => handleEquip(item)} disabled={loading}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    equipped
                      ? 'bg-primary/20 text-primary hover:bg-primary/30'
                      : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                  }`}
                >
                  {loading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : equipped ? <><Check className="w-3 h-3" /> Equipado</> : 'Equipar'}
                </button>
              ) : (
                <button onClick={() => handleBuy(item)} disabled={loading || !canAfford}
                  className="w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <><CircleDollarSign className="w-3 h-3" />{item.price_sc} SC</>}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {tabItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <ShoppingBag className="w-8 h-8 text-muted-foreground mb-3 opacity-40" />
          <p className="text-foreground font-semibold">Sin items en esta categoría</p>
        </div>
      )}
    </div>
  )
}
