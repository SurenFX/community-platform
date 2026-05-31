'use server'

export async function announceRaffleStart(keyword: string) {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:3001'
  const secret    = process.env.WORKER_SECRET ?? ''

  await fetch(`${workerUrl}/twitch/raffle/start`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-worker-secret': secret },
    body:    JSON.stringify({ keyword }),
  }).catch(err => console.error('announceRaffleStart error:', err))
}

export async function announceRaffleWinner(winner: string) {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:3001'
  const secret    = process.env.WORKER_SECRET ?? ''

  await fetch(`${workerUrl}/twitch/raffle/winner`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-worker-secret': secret },
    body:    JSON.stringify({ winner }),
  }).catch(err => console.error('announceRaffleWinner error:', err))
}
