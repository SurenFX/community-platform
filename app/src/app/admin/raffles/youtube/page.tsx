import YoutubeRaffle from '@/components/raffles/YoutubeRaffle'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AdminYoutubeRafflePage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/raffles"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver a Sorteos
      </Link>
      <YoutubeRaffle />
    </div>
  )
}
