'use client'

import { useState, useTransition } from 'react'
import { updateProfile } from '@/app/auth/actions'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import type { Profile } from '@/types/database'

interface EditProfileFormProps {
  profile: Profile
  onSave?: () => void
}

export default function EditProfileForm({ profile, onSave }: EditProfileFormProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await updateProfile(formData)
      setResult(res)
      if (res?.success && onSave) onSave()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Username
        </label>
        <input
          name="username"
          defaultValue={profile.username}
          placeholder="tu_username"
          maxLength={30}
          className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Solo letras, números y guión bajo. 3-30 caracteres.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Bio
        </label>
        <textarea
          name="bio"
          defaultValue={profile.bio ?? ''}
          placeholder="Contale algo a la comunidad..."
          rows={3}
          maxLength={200}
          className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none"
        />
      </div>

      {/* Feedback */}
      {result?.error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {result.error}
        </div>
      )}
      {result?.success && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-2.5">
          <Check className="w-4 h-4 shrink-0" />
          Perfil actualizado correctamente
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold py-2.5 rounded-lg transition-all duration-200"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {isPending ? 'Guardando...' : 'Guardar cambios'}
      </button>

    </form>
  )
}
