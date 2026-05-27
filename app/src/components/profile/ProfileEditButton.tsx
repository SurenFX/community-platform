'use client'

import { useState } from 'react'
import { Edit2 } from 'lucide-react'
import EditProfileModal from './EditProfileModal'

interface ProfileEditButtonProps {
  username: string
  bio: string | null
}

export default function ProfileEditButton({ username, bio }: ProfileEditButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shrink-0"
      >
        <Edit2 className="w-3.5 h-3.5" />
        Editar
      </button>

      {open && (
        <EditProfileModal
          username={username}
          bio={bio}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
