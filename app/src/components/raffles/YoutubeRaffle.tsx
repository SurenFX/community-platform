'use client'

import { useState, useEffect, useRef } from 'react'
import { Youtube, MessageSquare, Eye, ArrowLeft, Trophy, Shuffle, Loader2, Check, Users, Hash, ExternalLink, ChevronDown } from 'lucide-react'
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
  videoId:     string
}

type Stage = 'select' | 'confirm' | 'spinning' | 'winner'

export default function YoutubeRaffle({ backHref = '/dashboard/raffles' }: { backHref?: string }) {
  const [videos,          setVideos]          = useState<Video[]>([])
  const [loadingVideos,   setLoadingVideos]   = useState(true)
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set())
  const [multiEntry,      setMultiEntry]      = useState(false) // false = 1 entrada por persona, true = 1 por video
  const [showAllComments, setShowAllComments] = useState(false)
  const [comments,        setComments]        = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [stage,           setStage]           = useState<Stage>('select')
  const [winner,          setWinner]          = useState<Comment | null>(null)
  const [spinningName,    setSpinningName]    = useState('')
  const [error,           setError]           = useState<string | null>(null)
  const spinIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetchVideos() }, [])

  async function fetchVideos() {
    try {
      setLoadingVideos(true)
      setError(null)

      const channelRes = await fetch(
        `${API_BASE}/channels?part=contentDetails&id=${CHANNEL_ID}&key=${YOUTUBE_API_KEY}`
      )
      const channelData = await channelRes.json()
      if (channelData.error) throw new Error(channelData.error.message)

      const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
      if (!uploadsId) throw new Error('No se encontró la playlist del canal')

      const playlistRes = await fetch(
        `${API_BASE}/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=20&key=${YOUTUBE_API_KEY}`
      )
      const playlistData = await playlistRes.json()
      if (playlistData.error) throw new Error(playlistData.error.message)

      const videoIds = playlistData.items
        .map((item: any) => item.contentDetails.videoId)
        .join(',')

      const detailsRes = await fetch(
        `${API_BASE}/videos?part=snippet,statistics,contentDetails,liveStreamingDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`
      )
      const detailsData = await detailsRes.json()
      if (detailsData.error) throw new Error(detailsData.error.message)

      const filtered: Video[] = detailsData.items
        .filter((v: any) => {
          if (v.liveStreamingDetails) return false
          if (isShortVideo(v.contentDetails.duration)) return false
          return true
        })
        .slice(0, 9)
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

  function toggleVideo(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function loadComments() {
    if (!selectedIds.size) return
    try {
      setLoadingComments(true)
      setError(null)
      setStage('confirm')

      const allComments: Comment[] = []
      const seenAuthors = new Set<string>() // solo para modo único

      for (const videoId of selectedIds) {
        const res = await fetch(
          `${API_BASE}/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&order=relevance&key=${YOUTUBE_API_KEY}`
        )
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)

        for (const item of data.items ?? []) {
          const c = item.snippet.topLevelComment.snippet

          if (!multiEntry) {
            // Modo único: si ya comentó en otro video, no se agrega de nuevo
            if (seenAuthors.has(c.authorDisplayName)) continue
            seenAuthors.add(c.authorDisplayName)
          }

          allComments.push({
            id:          `${item.id}_${videoId}`,
            author:      c.authorDisplayName,
            authorPhoto: c.authorProfileImageUrl,
            text:        c.textDisplay,
            likeCount:   c.likeCount ?? 0,
            publishedAt: c.publishedAt,
            videoId,
          })
        }
      }

      setComments(allComments)
    } catch (err: any) {
      setError(`No se pudieron cargar los comentarios: ${err.message}`)
      setStage('select')
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
    setStage('select')
    setSelectedIds(new Set())
    setComments([])
    setWinner(null)
    setSpinningName('')
    setError(null)
    setShowAllComments(false)
  }

  const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : n.toString()
  const ago = (date: string) => {
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
    if (d === 0) return 'hoy'
    if (d < 30)  return `${d}d`
    return `${Math.floor(d/30)}m`
  }

  const selectedVideos = videos.filter(v => selectedIds.has(v.id))
  const totalComments  = selectedVideos.reduce((acc, v) => acc + v.commentCount, 0)

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
          <p className="text-muted-foreground text-sm mt-0.5">Seleccioná uno o más videos y sorteá entre sus comentaristas</p>
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
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Últimos videos del canal
            </p>
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
            <>
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${selectedIds.size > 0 ? 'pb-36' : ''}`}>
                {videos.map(video => {
                  const isSelected = selectedIds.has(video.id)
                  return (
                    <button key={video.id} onClick={() => toggleVideo(video.id)}
                      className={`relative bg-card border rounded-xl overflow-hidden text-left transition-all duration-200 group isolate ${
                        isSelected
                          ? 'border-red-400/60 shadow-lg shadow-red-400/10'
                          : 'border-border hover:border-red-400/30'
                      }`}>

                      {/* Checkbox overlay */}
                      <div className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-red-500 border-red-500'
                          : 'bg-black/50 border-white/50 group-hover:border-white'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>

                      <div className="relative aspect-video overflow-hidden">
                        <img src={video.thumbnail} alt={video.title}
                          className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`} />
                        <div className={`absolute inset-0 transition-colors ${isSelected ? 'bg-red-500/10' : 'bg-black/20 group-hover:bg-black/10'}`} />
                        <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">{video.duration}</div>
                      </div>

                      <div className="p-4">
                        <p className="text-sm font-semibold text-foreground line-clamp-2 mb-3 leading-snug">{video.title}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmt(video.viewCount)}</span>
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{fmt(video.commentCount)}</span>
                          </div>
                          <span>{ago(video.publishedAt)}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Barra de acción */}
              {selectedIds.size > 0 && (
                <div className="sticky bottom-4 z-20 bg-card/95 backdrop-blur-sm border border-red-400/30 rounded-2xl p-4 space-y-3 shadow-xl shadow-black/40">
                  {/* Modo de participación */}
                  <div className="flex gap-2">
                    <button onClick={() => setMultiEntry(false)}
                      className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        !multiEntry ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'border-border text-muted-foreground hover:border-red-400/20'
                      }`}>
                      <Users className="w-4 h-4 shrink-0" />
                      <div className="text-left">
                        <p className="font-semibold leading-none">1 entrada por persona</p>
                        <p className="text-[11px] opacity-70 mt-0.5">Todos tienen las mismas chances</p>
                      </div>
                    </button>
                    <button onClick={() => setMultiEntry(true)}
                      className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        multiEntry ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'border-border text-muted-foreground hover:border-red-400/20'
                      }`}>
                      <Hash className="w-4 h-4 shrink-0" />
                      <div className="text-left">
                        <p className="font-semibold leading-none">1 entrada por video</p>
                        <p className="text-[11px] opacity-70 mt-0.5">Más videos comentados = más chances</p>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {selectedIds.size} video{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                      </p>
                      {multiEntry
                        ? <p className="text-xs text-muted-foreground">~{fmt(totalComments)} entradas en total</p>
                        : <p className="text-xs text-muted-foreground">≤{fmt(totalComments)} participantes únicos</p>
                      }
                    </div>
                    <button onClick={loadComments} disabled={loadingComments}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-[1.02]">
                      {loadingComments
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</>
                        : <><MessageSquare className="w-4 h-4" /> Cargar comentaristas</>
                      }
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CONFIRM */}
      {stage === 'confirm' && (
        <div className="space-y-5">
          {/* Videos seleccionados */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground mb-3">Videos incluidos ({selectedVideos.length})</p>
            {selectedVideos.map(v => (
              <div key={v.id} className="flex items-center gap-3">
                <img src={v.thumbnail} alt={v.title} className="w-16 h-10 object-cover rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{fmt(v.commentCount)} comentarios</p>
                </div>
              </div>
            ))}
          </div>

          {loadingComments ? (
            <div className="bg-card border border-border rounded-2xl p-10 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Cargando comentarios de {selectedIds.size} videos...</p>
            </div>
          ) : (
            <>
              <div className="bg-secondary/50 border border-border rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                {multiEntry
                  ? <><Hash className="w-4 h-4 text-red-400" /> <span className="text-foreground font-medium">1 entrada por video</span> <span className="text-muted-foreground">— más videos comentados = más chances</span></>
                  : <><Users className="w-4 h-4 text-red-400" /> <span className="text-foreground font-medium">1 entrada por persona</span> <span className="text-muted-foreground">— todos tienen las mismas chances</span></>
                }
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: multiEntry ? 'Entradas totales' : 'Participantes únicos', value: comments.length },
                  { label: 'Videos',               value: selectedIds.size },
                  { label: 'Chance mín.',          value: comments.length > 0 ? `${(1/comments.length*100).toFixed(1)}%` : '—' },
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
                    {!showAllComments && comments.length > 5 && (
                      <button onClick={() => setShowAllComments(true)}
                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                        Ver todos <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className={`divide-y divide-border ${!showAllComments ? 'max-h-72' : 'max-h-[32rem]'} overflow-y-auto`}>
                    {(showAllComments ? comments : comments.slice(0, 5)).map(c => {
                      const originalCommentId = c.id.includes('_') ? c.id.split('_')[0] : c.id
                      const commentUrl = `https://youtube.com/watch?v=${c.videoId}&lc=${originalCommentId}`
                      return (
                        <div key={c.id} className="flex items-start gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors group">
                          <img src={c.authorPhoto} alt={c.author} className="w-8 h-8 rounded-full shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{c.author}</p>
                            <a href={commentUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary mt-0.5 line-clamp-1 transition-colors inline-block w-full">
                              {c.text}
                            </a>
                          </div>
                          <a href={commentUrl} target="_blank" rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                          </a>
                        </div>
                      )
                    })}
                  </div>
                  {!showAllComments && comments.length > 5 && (
                    <button onClick={() => setShowAllComments(true)}
                      className="w-full py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors border-t border-border flex items-center justify-center gap-1">
                      <ChevronDown className="w-3.5 h-3.5" />
                      Ver {comments.length - 5} participantes más
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={reset} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                  Cambiar selección
                </button>
                <button onClick={startSpin} disabled={!comments.length}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Shuffle className="w-4 h-4" />¡Sortear entre {comments.length} participantes!
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
          <p className="text-xs text-muted-foreground">{comments.length} participantes de {selectedIds.size} videos</p>
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
                {(() => {
                  const winnerVideo = videos.find(v => v.id === winner.videoId)
                  return winnerVideo ? (
                    <a href={winnerVideo.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1 mt-0.5 transition-colors">
                      <Youtube className="w-3.5 h-3.5 shrink-0" />
                      <span className="line-clamp-1">{winnerVideo.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : null
                })()}
              </div>
            </div>
            {(() => {
              const originalCommentId = winner.id.includes('_') ? winner.id.split('_')[0] : winner.id
              const commentUrl = `https://youtube.com/watch?v=${winner.videoId}&lc=${originalCommentId}`
              return (
                <a href={commentUrl} target="_blank" rel="noopener noreferrer"
                  className="block bg-secondary/50 border border-border hover:border-primary/40 rounded-xl p-4 text-left max-w-md mx-auto transition-colors group">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    Su comentario
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">"{winner.text}"</p>
                </a>
              )
            })()}
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
              Nuevo sorteo
            </button>
            <button onClick={startSpin} className="flex-1 flex items-center justify-center gap-2 bg-card border border-red-400/30 hover:border-red-400/60 text-red-400 font-semibold py-3 rounded-xl transition-all">
              <Shuffle className="w-4 h-4" />Sortear de nuevo
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
