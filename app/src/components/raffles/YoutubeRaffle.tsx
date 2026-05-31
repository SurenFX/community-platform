'use client'

import { useState, useEffect, useRef } from 'react'
import { Youtube, MessageSquare, Eye, ArrowLeft, Trophy, Shuffle, Loader2, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY
const CHANNEL_ID      = 'UCrEPUgjVon78Htzr_ZrJ7ug'
const API_BASE        = 'https://www.googleapis.com/youtube/v3'

interface Video {
  id:           string
  title:        string
  thumbnail:    string
  commentCount: number
  viewCount:    number
  publishedAt:  string
  url:          string
  duration:     string
}

interface Comment {
  id:          string
  author:      string
  authorPhoto: string
  text:        string
  likeCount:   number
  publishedAt: string
}

type Stage = 'select' | 'confirm' | 'spinning' | 'winner'

export default function YoutubeRaffle({ backHref = '/dashboard/raffles' }: { backHref?: string }) {
  const [videos,          setVideos]          = useState<Video[]>([])
  const [loadingVideos,   setLoadingVideos]   = useState(true)
  const [selectedVideo,   setSelectedVideo]   = useState<Video | null>(null)
  const [comments,        setComments]        = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [stage,           setStage]           = useState<Stage>('select')
  const [winner,          setWinner]          = useState<Comment | null>(null)
  const [spinningName,    setSpinningName]    = useState('')
  const [error,           setError]           = useState<string | null>(null)
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { fetchVideos() }, [])

  async function fetchVideos() {
    try {
      setLoadingVideos(true)
      setError(null)

      // 1. Obtener la playlist de uploads del canal
      const channelRes = await fetch(
        `${API_BASE}/channels?part=contentDetails&id=${CHANNEL_ID}&key=${YOUTUBE_API_KEY}`
      )
      const channelData = await channelRes.json()
      if (channelData.error) throw new Error(channelData.error.message)

      const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
      if (!uploadsId) throw new Error('No se encontró la playlist del canal')

      // 2. Obtener los últimos 20 items para tener margen de filtrado
      const playlistRes = await fetch(
        `${API_BASE}/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=20&key=${YOUTUBE_API_KEY}`
      )
      const playlistData = await playlistRes.json()
      if (playlistData.error) throw new Error(playlistData.error.message)

      const videoIds = playlistData.items
        .map((item: any) => item.contentDetails.videoId)
        .join(',')

      // 3. Obtener detalles con liveStreamingDetails — el campo clave
      // Si un video tiene liveStreamingDetails, fue un live (pasado o activo)
      const detailsRes = await fetch(
        `${API_BASE}/videos?part=snippet,statistics,contentDetails,liveStreamingDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`
      )
      const detailsData = await detailsRes.json()
      if (detailsData.error) throw new Error(detailsData.error.message)

      const filtered: Video[] = detailsData.items
        .filter((v: any) => {
          // Excluir si tiene liveStreamingDetails (fue un live, sin importar el estado)
          if (v.liveStreamingDetails) return false

          // Excluir Shorts (duración menor a 60 segundos)
          if (isShortVideo(v.contentDetails.duration)) return false

          return true
        })
        .slice(0, 6)
        .map((v: any) => ({
          id:           v.id,
          title:        v.snippet.title,
          thumbnail:    v.snippet.thumbnails.medium?.url ?? v.snippet.thumbnails.default?.url,
          commentCount: parseInt(v.statistics.commentCount ?? '0'),
          viewCount:    parseInt(v.statistics.viewCount    ?? '0'),
          publishedAt:  v.snippet.publishedAt,
          url:          `https://youtube.com/watch?v=${v.id}`,
          duration:     formatDuration(v.contentDetails.duration),
        }))

      setVideos(filtered)
    } catch (err: any) {
      setError(`No se pudieron cargar los videos: ${err.message}`)
    } finally {
      setLoadingVideos(false)
    }
  }

  function isShortVideo(isoDuration: string): boolean {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return false
    const total = (parseInt(match[1] ?? '0') * 3600) +
                  (parseInt(match[2] ?? '0') * 60)   +
                   parseInt(match[3] ?? '0')
    return total < 60
  }

  function formatDuration(isoDuration: string): string {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return ''
    const h = parseInt(match[1] ?? '0')
    const m = parseInt(match[2] ?? '0')
    const s = parseInt(match[3] ?? '0')
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${m}:${String(s).padStart(2,'0')}`
  }

  async function loadComments(video: Video) {
    try {
      setLoadingComments(true)
      setSelectedVideo(video)
      setStage('confirm')
      const res = await fetch(
        `${API_BASE}/commentThreads?part=snippet&videoId=${video.id}&maxResults=100&order=relevance&key=${YOUTUBE_API_KEY}`
      )
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      setComments((data.items ?? []).map((item: any) => {
        const c = item.snippet.topLevelComment.snippet
        return {
          id: item.id, author: c.authorDisplayName,
          authorPhoto: c.authorProfileImageUrl,
          text: c.textDisplay, likeCount: c.likeCount ?? 0,
          publishedAt: c.publishedAt,
        }
      }))
    } catch (err: any) {
      setError(`No se pudieron cargar los comentarios: ${err.message}`)
    } finally {
      setLoadingComments(false)
    }
  }

  function startSpin() {
    if (!comments.length) return
    setStage('spinning')
    setWinner(null)
    let speed = 50, elapsed = 0
    const total = 4000
    function tick() {
      setSpinningName(comments[Math.floor(Math.random() * comments.length)].author)
      elapsed += speed
      if (elapsed > total * 0.6)  speed = 120
      if (elapsed > total * 0.8)  speed = 250
      if (elapsed > total * 0.92) speed = 500
      if (elapsed >= total) {
        const picked = comments[Math.floor(Math.random() * comments.length)]
        setWinner(picked)
        setSpinningName(picked.author)
        setTimeout(() => setStage('winner'), 400)
      } else {
        spinIntervalRef.current = setTimeout(tick, speed)
      }
    }
    spinIntervalRef.current = setTimeout(tick, speed)
  }

  function reset() {
    if (spinIntervalRef.current) clearTimeout(spinIntervalRef.current)
    setStage('select'); setSelectedVideo(null); setComments([])
    setWinner(null); setSpinningName(''); setError(null)
  }

  const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : n.toString()
  const ago = (date: string) => {
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
    if (d === 0) return 'hoy'
    if (d < 30)  return `${d}d`
    return `${Math.floor(d/30)}m`
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      <div className="flex items-center gap-4">
        <Link href={backHref} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Youtube className="w-6 h-6 text-red-400" />
            Sorteo en YouTube
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Sorteá entre los comentarios de un video del canal</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-5 py-4 text-sm flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={fetchVideos} className="text-xs underline shrink-0">Reintentar</button>
        </div>
      )}

      {/* SELECT */}
      {stage === 'select' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Últimos 6 videos del canal</p>
            <p className="text-xs text-muted-foreground">Lives y Shorts excluidos</p>
          </div>
          {loadingVideos ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
                  <div className="aspect-video bg-secondary" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-secondary rounded w-3/4" />
                    <div className="h-3 bg-secondary rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map(video => (
                <button key={video.id} onClick={() => loadComments(video)}
                  className="bg-card border border-border hover:border-red-400/50 rounded-xl overflow-hidden text-left transition-all duration-200 hover:shadow-lg hover:shadow-red-400/5 group">
                  <div className="relative aspect-video overflow-hidden">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">{video.duration}</div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-foreground line-clamp-2 mb-3 leading-snug">{video.title}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmt(video.viewCount)}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{fmt(video.commentCount)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{ago(video.publishedAt)}</span>
                        <ChevronRight className="w-3 h-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONFIRM */}
      {stage === 'confirm' && selectedVideo && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex gap-5 p-5">
              <img src={selectedVideo.thumbnail} alt={selectedVideo.title} className="w-32 h-20 object-cover rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-foreground mb-2 line-clamp-2">{selectedVideo.title}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" />{fmt(selectedVideo.viewCount)}</span>
                  <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" />{fmt(selectedVideo.commentCount)}</span>
                </div>
                <a href={selectedVideo.url} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 hover:text-red-300 mt-2 inline-block">Ver en YouTube →</a>
              </div>
            </div>
          </div>

          {loadingComments ? (
            <div className="bg-card border border-border rounded-2xl p-10 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Cargando comentarios...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Participantes', value: comments.length },
                  { label: 'Ganadores',     value: 1 },
                  { label: 'Chance',        value: comments.length > 0 ? `${(1/comments.length*100).toFixed(1)}%` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {comments.length > 0 && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Participantes ({comments.length})</p>
                    <p className="text-xs text-muted-foreground">Primeros 5</p>
                  </div>
                  <div className="divide-y divide-border">
                    {comments.slice(0,5).map(c => (
                      <div key={c.id} className="flex items-start gap-3 px-5 py-3">
                        <img src={c.authorPhoto} alt={c.author} className="w-8 h-8 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{c.author}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.text}</p>
                        </div>
                      </div>
                    ))}
                    {comments.length > 5 && (
                      <p className="px-5 py-3 text-center text-xs text-muted-foreground">y {comments.length - 5} más...</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={reset} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">Cambiar video</button>
                <button onClick={startSpin} disabled={!comments.length}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Shuffle className="w-4 h-4" />¡Sortear!
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* SPINNING */}
      {stage === 'spinning' && (
        <div className="bg-card border border-red-400/30 rounded-2xl p-12 text-center space-y-6">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Sorteando...</p>
          <div className="w-20 h-20 rounded-full border-4 border-red-400/30 border-t-red-400 animate-spin mx-auto" />
          <p className="text-3xl font-black text-foreground animate-pulse min-h-[2.5rem]">{spinningName}</p>
          <div className="flex items-center justify-center gap-1">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-2 bg-red-400 rounded-full animate-bounce"
                style={{ height: `${8 + (i % 4) * 8}px`, animationDelay: `${i * 0.1}s`, animationDuration: '0.6s' }} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{comments.length} participantes</p>
        </div>
      )}

      {/* WINNER */}
      {stage === 'winner' && winner && (
        <div className="space-y-5">
          <div className="bg-card border border-yellow-400/30 rounded-2xl p-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-400/20 border border-yellow-400/30 mb-4">
              <Trophy className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-4">🎉 ¡Ganador del sorteo!</p>
            <div className="flex items-center justify-center gap-3 mb-5">
              <img src={winner.authorPhoto} alt={winner.author} className="w-14 h-14 rounded-full ring-4 ring-yellow-400/30" />
              <div className="text-left">
                <p className="text-2xl font-black text-foreground">{winner.author}</p>
                <p className="text-sm text-muted-foreground">Comentó en el video</p>
              </div>
            </div>
            <div className="bg-secondary/50 border border-border rounded-xl p-4 text-left max-w-md mx-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Su comentario:</p>
              <p className="text-sm text-foreground leading-relaxed">"{winner.text}"</p>
            </div>
          </div>

          {selectedVideo && (
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <img src={selectedVideo.thumbnail} alt={selectedVideo.title} className="w-20 h-14 object-cover rounded-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Video sorteado</p>
                <p className="text-sm font-semibold text-foreground line-clamp-1">{selectedVideo.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{comments.length} participantes</p>
              </div>
              <a href={selectedVideo.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-xs bg-red-400/15 text-red-400 hover:bg-red-400/25 px-3 py-1.5 rounded-lg transition-colors">
                Ver video
              </a>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">Nuevo sorteo</button>
            <button onClick={startSpin} className="flex-1 flex items-center justify-center gap-2 bg-card border border-red-400/30 hover:border-red-400/60 text-red-400 font-semibold py-3 rounded-xl transition-all">
              <Shuffle className="w-4 h-4" />Sortear de nuevo
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
