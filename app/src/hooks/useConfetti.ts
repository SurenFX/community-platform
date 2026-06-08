import confetti from 'canvas-confetti'

const COLORS = ['#22d3ee', '#a855f7', '#facc15', '#4ade80', '#f472b6']

export function useConfetti() {
  function burst() {
    confetti({
      particleCount: 90,
      spread: 70,
      origin:        { x: 0.5, y: 0.55 },
      colors:        COLORS,
      scalar:        1.1,
    })
  }

  function questClaim() {
    confetti({
      particleCount: 60,
      spread: 55,
      origin:        { x: 0.5, y: 0.65 },
      colors:        ['#facc15', '#22d3ee', '#4ade80'],
      scalar:        0.9,
    })
  }

  function levelUp() {
    confetti({ particleCount: 70, angle: 60,  spread: 60, origin: { x: 0 }, colors: COLORS })
    confetti({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1 }, colors: COLORS })
  }

  return { burst, questClaim, levelUp }
}
