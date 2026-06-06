'use client'

import { useState, useTransition } from 'react'
import { CircleDollarSign, Loader2, Check, ShoppingBag } from 'lucide-react'
import { purchaseItem, equipItem, unequipItem } from '@/app/actions/shop'

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

type Tab = 'BORDER_COLOR' | 'NAME_EMOJI' | 'CUSTOM_TITLE'

interface ShopItem {
  id: string; name: string; description: string
  type: string; value: string; price_sc: number
  rarity: string; sort_order: number
}

interface Props {
  items:            ShopItem[]
  balance:          number
  inventoryIds:     Set<string>
  equippedBorder:   string | null
  equippedEmoji:    string | null
  equippedTitle:    string | null
}

export default function ShopClient({
  items, balance: initialBalance,
  inventoryIds: initialInv,
  equippedBorder: initBorder,
  equippedEmoji: initEmoji,
  equippedTitle: initTitle,
}: Props) {
  const [tab,      setTab]      = useState<Tab>('BORDER_COLOR')
  const [balance,  setBalance]  = useState(initialBalance)
  const [inv,      setInv]      = useState(new Set(initialInv))
  const [border,   setBorder]   = useState(initBorder)
  const [emoji,    setEmoji]    = useState(initEmoji)
  const [title,    setTitle]    = useState(initTitle)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  const tabItems = items.filter(i => i.type === tab).sort((a, b) => a.sort_order - b.sort_order)

  function getEquipped(item: ShopItem) {
    if (item.type === 'BORDER_COLOR') return border === item.value
    if (item.type === 'NAME_EMOJI')   return emoji === item.value
    if (item.type === 'CUSTOM_TITLE') return title === item.value
    return false
  }

  function handleBuy(item: ShopItem) {
    setError(null)
    setActionId(item.id)
    start(async () => {
      const r = await purchaseItem(item.id)
      if (r.error) { setError(r.error) }
      else {
        setInv(prev => new Set([...prev, item.id]))
        setBalance(b => b - item.price_sc)
      }
      setActionId(null)
    })
  }

  function handleEquip(item: ShopItem) {
    setError(null)
    const isEquipped = getEquipped(item)
    setActionId(item.id)
    start(async () => {
      const r = isEquipped
        ? await unequipItem(item.type)
        : await equipItem(item.id, item.type)
      if (r.error) { setError(r.error) }
      else {
        if (item.type === 'BORDER_COLOR') setBorder(isEquipped ? null : item.value)
        if (item.type === 'NAME_EMOJI')   setEmoji(isEquipped ? null : item.value)
        if (item.type === 'CUSTOM_TITLE') setTitle(isEquipped ? null : item.value)
      }
      setActionId(null)
    })
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'BORDER_COLOR',  label: 'Marcos de avatar', icon: '🖼️' },
    { key: 'NAME_EMOJI',    label: 'Emojis',           icon: '✨' },
    { key: 'CUSTOM_TITLE',  label: 'Títulos',          icon: '📛' },
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

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
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

          return (
            <div
              key={item.id}
              className={`relative flex flex-col bg-card border rounded-2xl p-4 transition-all ${rarity.border} ${equipped ? 'ring-2 ring-primary/50' : ''}`}
              style={rarity.glow ? { boxShadow: rarity.glow } : undefined}
            >
              {/* Rarity badge */}
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full self-start mb-3 ${rarity.badge}`}>
                {item.rarity}
              </span>

              {/* Preview */}
              <div className="flex items-center justify-center h-14 mb-3">
                {item.type === 'BORDER_COLOR' && (
                  <div
                    className="w-10 h-10 rounded-full bg-secondary"
                    style={{ border: `3px solid ${BORDER_COLOR_HEX[item.value] ?? '#888'}`, boxShadow: `0 0 12px ${BORDER_COLOR_HEX[item.value] ?? '#888'}40` }}
                  />
                )}
                {item.type === 'NAME_EMOJI' && (
                  <span className="text-3xl">{item.value}</span>
                )}
                {item.type === 'CUSTOM_TITLE' && (
                  <span className="text-xs font-bold text-center text-foreground px-1">{item.value}</span>
                )}
              </div>

              {/* Info */}
              <p className="text-xs font-semibold text-foreground mb-0.5 truncate">{item.name}</p>
              <p className="text-[11px] text-muted-foreground mb-3 flex-1 line-clamp-2">{item.description}</p>

              {/* Precio + botón */}
              {owned ? (
                <button
                  onClick={() => handleEquip(item)}
                  disabled={loading}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    equipped
                      ? 'bg-primary/20 text-primary hover:bg-primary/30'
                      : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                  }`}
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : equipped ? <><Check className="w-3 h-3" /> Equipado</> : 'Equipar'}
                </button>
              ) : (
                <button
                  onClick={() => handleBuy(item)}
                  disabled={loading || !canAfford}
                  className="w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <><CircleDollarSign className="w-3 h-3" />{item.price_sc} SC</>
                  }
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
