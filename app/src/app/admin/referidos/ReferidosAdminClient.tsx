'use client'

import { useState, useTransition } from 'react'
import { Plus, Edit2, Trash2, Loader2, X, ExternalLink, MousePointerClick, Eye, EyeOff } from 'lucide-react'
import { createReferralLink, updateReferralLink, deleteReferralLink } from '@/app/actions/admin'

interface ReferralLink {
  id:             string
  game_name:      string
  game_image_url: string
  referral_url:   string
  description:    string
  click_count:    number
  is_active:      boolean
  sort_order:     number
}

const EMPTY_FORM = {
  game_name:      '',
  game_image_url: '',
  referral_url:   '',
  description:    '',
  sort_order:     0,
  is_active:      true,
}

const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"

export default function ReferidosAdminClient({ links: initialLinks }: { links: ReferralLink[] }) {
  const [links,      setLinks]      = useState(initialLinks)
  const [showForm,   setShowForm]   = useState(false)
  const [editId,     setEditId]     = useState<string | null>(null)
  const [form,       setForm]       = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [isPending,  start]         = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  function openCreate() {
    setForm({ ...EMPTY_FORM, sort_order: links.length + 1 })
    setEditId(null)
    setShowForm(true)
    setError(null)
  }

  function openEdit(l: ReferralLink) {
    setForm({
      game_name:      l.game_name,
      game_image_url: l.game_image_url,
      referral_url:   l.referral_url,
      description:    l.description,
      sort_order:     l.sort_order,
      is_active:      l.is_active,
    })
    setEditId(l.id)
    setShowForm(true)
    setError(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setError(null)
  }

  function handleSubmit() {
    if (!form.game_name.trim() || !form.game_image_url.trim() || !form.referral_url.trim()) {
      setError('Nombre, imagen y URL de referido son obligatorios')
      return
    }
    start(async () => {
      const result = editId
        ? await updateReferralLink(editId, form)
        : await createReferralLink(form)

      if (result?.error) { setError(result.error); return }

      if (editId) {
        setLinks(prev => prev.map(l => l.id === editId ? { ...l, ...form } : l))
      } else {
        setLinks(prev => [...prev, { id: crypto.randomUUID(), click_count: 0, ...form }])
      }
      closeForm()
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    start(async () => {
      const result = await deleteReferralLink(id)
      setDeletingId(null)
      if (!result?.error) setLinks(prev => prev.filter(l => l.id !== id))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar juego
        </button>
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">
                {editId ? 'Editar juego' : 'Agregar juego'}
              </h2>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Nombre del juego *
                </label>
                <input
                  className={inputClass}
                  placeholder="ej: Pixels, Axie Infinity..."
                  value={form.game_name}
                  onChange={e => setForm(f => ({ ...f, game_name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  URL de imagen (banner/cover) *
                </label>
                <input
                  className={inputClass}
                  placeholder="https://..."
                  value={form.game_image_url}
                  onChange={e => setForm(f => ({ ...f, game_image_url: e.target.value }))}
                />
                {form.game_image_url && (
                  <div className="mt-2 rounded-lg overflow-hidden h-28 bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.game_image_url} alt="preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  URL de referido *
                </label>
                <input
                  className={inputClass}
                  placeholder="https://juego.com/register?ref=salchi"
                  value={form.referral_url}
                  onChange={e => setForm(f => ({ ...f, referral_url: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Descripción corta (opcional)
                </label>
                <input
                  className={inputClass}
                  placeholder="ej: Registrate y conseguí bonus de bienvenida"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Orden
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm text-foreground">Activo (visible)</span>
                  </label>
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={closeForm}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                {editId ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de links */}
      {links.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MousePointerClick className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay juegos cargados todavía</p>
          <p className="text-xs mt-1">Hacé clic en "Agregar juego" para empezar</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Juego</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Link</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Clics</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {links
                .sort((a, b) => a.sort_order - b.sort_order || a.game_name.localeCompare(b.game_name))
                .map(link => (
                <tr key={link.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {link.game_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={link.game_image_url}
                          alt={link.game_name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div>
                        <p className="font-medium text-foreground">{link.game_name}</p>
                        {link.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{link.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={link.referral_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline text-xs max-w-xs truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {link.referral_url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center gap-1 text-muted-foreground">
                      <MousePointerClick className="w-3.5 h-3.5" />
                      {link.click_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {link.is_active ? (
                      <span className="flex items-center justify-center gap-1 text-green-400 text-xs">
                        <Eye className="w-3.5 h-3.5" /> Activo
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                        <EyeOff className="w-3.5 h-3.5" /> Oculto
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEdit(link)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        disabled={deletingId === link.id}
                        className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Eliminar"
                      >
                        {deletingId === link.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
