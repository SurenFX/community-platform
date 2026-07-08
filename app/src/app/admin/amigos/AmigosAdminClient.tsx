'use client'

import { useState, useTransition } from 'react'
import { Plus, Edit2, Trash2, Loader2, X, Radio } from 'lucide-react'
import { createFriendStreamer, updateFriendStreamer, deleteFriendStreamer } from '@/app/actions/admin'

interface FriendStreamer {
  id:           string
  name:         string
  kick_slug:    string
  twitch_login: string | null
  is_active:    boolean
}

const EMPTY_FORM = { name: '', kick_slug: '', twitch_login: '', is_active: true }

const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"

export default function AmigosAdminClient({ friends: initialFriends }: { friends: FriendStreamer[] }) {
  const [friends,    setFriends]    = useState(initialFriends)
  const [showForm,   setShowForm]   = useState(false)
  const [editId,     setEditId]     = useState<string | null>(null)
  const [form,       setForm]       = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [isPending,  start]         = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
    setError(null)
  }

  function openEdit(f: FriendStreamer) {
    setForm({ name: f.name, kick_slug: f.kick_slug, twitch_login: f.twitch_login ?? '', is_active: f.is_active })
    setEditId(f.id)
    setShowForm(true)
    setError(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setError(null)
  }

  function handleSubmit() {
    if (!form.name.trim() || (!form.kick_slug.trim() && !form.twitch_login.trim())) {
      setError('El nombre y al menos una plataforma (Kick o Twitch) son obligatorios')
      return
    }
    start(async () => {
      const payload = {
        ...form,
        kick_slug:    form.kick_slug.trim()    || null,
        twitch_login: form.twitch_login.trim() || null,
      }
      const result = editId
        ? await updateFriendStreamer(editId, payload)
        : await createFriendStreamer(payload)

      if (result?.error) { setError(result.error); return }

      if (editId) {
        setFriends(prev => prev.map(f => f.id === editId ? { ...f, ...payload } : f))
      } else {
        setFriends(prev => [...prev, { id: crypto.randomUUID(), ...payload } as FriendStreamer])
      }
      closeForm()
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    start(async () => {
      const result = await deleteFriendStreamer(id)
      setDeletingId(null)
      if (!result?.error) setFriends(prev => prev.filter(f => f.id !== id))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar amigo
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-semibold text-foreground">
                {editId ? 'Editar amigo' : 'Agregar amigo streamer'}
              </h2>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Nombre para mostrar *
                </label>
                <input
                  className={inputClass}
                  placeholder="ej: xStreamer"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Slug de Kick
                </label>
                <input
                  className={inputClass}
                  placeholder="ej: xstreamer (kick.com/xstreamer)"
                  value={form.kick_slug}
                  onChange={e => setForm(f => ({ ...f, kick_slug: e.target.value.toLowerCase().trim() }))}
                />
                {form.kick_slug && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    kick.com/<span className="text-foreground">{form.kick_slug}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Slug de Twitch (opcional)
                </label>
                <input
                  className={inputClass}
                  placeholder="ej: xstreamer (twitch.tv/xstreamer)"
                  value={form.twitch_login}
                  onChange={e => setForm(f => ({ ...f, twitch_login: e.target.value.toLowerCase().trim() }))}
                />
                {form.twitch_login && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    twitch.tv/<span className="text-foreground">{form.twitch_login}</span>
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-foreground">Activo (chequear su live)</span>
              </label>

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

      {/* Tabla */}
      {friends.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Todavía no hay amigos streamers</p>
          <p className="text-xs mt-1 opacity-70">Agregá el slug de Kick y/o login de Twitch y el bot los va a monitorear</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kick</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Twitch</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {friends.map(friend => (
                <tr key={friend.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{friend.name}</td>
                  <td className="px-4 py-3">
                    {friend.kick_slug ? (
                      <a
                        href={`https://kick.com/${friend.kick_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#53FC18] hover:underline text-xs"
                      >
                        kick.com/{friend.kick_slug}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {friend.twitch_login ? (
                      <a
                        href={`https://twitch.tv/${friend.twitch_login}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#9146FF] hover:underline text-xs"
                      >
                        twitch.tv/{friend.twitch_login}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${friend.is_active ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {friend.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEdit(friend)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(friend.id)}
                        disabled={deletingId === friend.id}
                        className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deletingId === friend.id
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
