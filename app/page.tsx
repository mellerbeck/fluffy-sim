"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Vec = { x: number; y: number }
type Mode = "idle" | "ball_flying" | "chasing" | "returning"

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)

export default function Home() {
  const [mode, setMode] = useState<Mode>("idle")

  const [dogPos, setDogPos] = useState<Vec>({ x: 0, y: 0 })
  const [ballPos, setBallPos] = useState<Vec>({ x: 0, y: 0 })
  const [ballVisible, setBallVisible] = useState(false)

  const [tailAngle, setTailAngle] = useState(0)
  const [runPhase, setRunPhase] = useState(0)
  const [capePhase, setCapePhase] = useState(0)
  const [facing, setFacing] = useState<1 | -1>(1)
  const [runAmount, setRunAmount] = useState(0)

  const [wetness, setWetness] = useState(0) // 0..100
  const [drying, setDrying] = useState(false)

  const dogPosRef = useRef<Vec>({ x: 0, y: 0 })
  const ballPosRef = useRef<Vec>({ x: 0, y: 0 })
  const ballVelRef = useRef<Vec>({ x: 0, y: 0 })
  const modeRef = useRef<Mode>("idle")

  const cursorRef = useRef<Vec>({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const lastTRef = useRef<number>(0)
  const lastDogRef = useRef<Vec>({ x: 0, y: 0 })

  const wetRef = useRef(0)
  const dryingRef = useRef(false)

  const WET_STOP = 85

  // init positions
  useEffect(() => {
    const x = window.innerWidth / 2
    const y = window.innerHeight / 2
    setDogPos({ x, y })
    setBallPos({ x, y })
    dogPosRef.current = { x, y }
    ballPosRef.current = { x, y }
    cursorRef.current = { x, y }
    lastDogRef.current = { x, y }
  }, [])

  // keep refs in sync
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    dogPosRef.current = dogPos
  }, [dogPos])
  useEffect(() => {
    ballPosRef.current = ballPos
  }, [ballPos])
  useEffect(() => {
    wetRef.current = wetness
  }, [wetness])
  useEffect(() => {
    dryingRef.current = drying
  }, [drying])

  // track cursor
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  // prevent context menu so right-click works
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault()
    window.addEventListener("contextmenu", prevent)
    return () => window.removeEventListener("contextmenu", prevent)
  }, [])

  // rain + movement + animations
  useEffect(() => {
    const gravity = 1800
    const groundPad = 32
    const baseDogSpeed = 560
    const pickupRadius = 30
    const returnRadius = 28

    const rainRate = 9 // wetness per second
    const passiveDry = 2.5 // wetness per second
    const dryerRate = 35 // wetness per second while drying

    const tick = (t: number) => {
      const last = lastTRef.current || t
      const dt = clamp((t - last) / 1000, 0, 0.05)
      lastTRef.current = t

      const w = window.innerWidth
      const h = window.innerHeight
      const groundY = h - groundPad

      // wetness update
      let wet = wetRef.current
      wet += rainRate * dt
      wet -= passiveDry * dt
      if (dryingRef.current) wet -= dryerRate * dt
      wet = clamp(wet, 0, 100)
      wetRef.current = wet
      setWetness(wet)

      const tooWet = wet >= WET_STOP
      const dogSpeed = tooWet ? 0 : baseDogSpeed

      let d = dogPosRef.current
      let b = ballPosRef.current
      let bv = ballVelRef.current
      const m = modeRef.current

      // ball physics always runs
      if (m === "ball_flying") {
        bv = { x: bv.x, y: bv.y + gravity * dt }
        b = { x: b.x + bv.x * dt, y: b.y + bv.y * dt }

        if (b.y >= groundY) {
          b = { x: b.x, y: groundY }
          bv = { x: bv.x * 0.55, y: -bv.y * 0.35 }
          if (Math.abs(bv.y) < 120) {
            bv = { x: 0, y: 0 }
            modeRef.current = "chasing"
            setMode("chasing")
          }
        }
        if (b.x < 12 || b.x > w - 12) {
          b = { x: clamp(b.x, 12, w - 12), y: b.y }
          bv = { x: -bv.x * 0.6, y: bv.y }
        }
      }

      const moveToward = (to: Vec) => {
        if (dogSpeed <= 0) return
        const dx = to.x - d.x
        const dy = to.y - d.y
        const L = Math.hypot(dx, dy) || 1
        const step = dogSpeed * dt
        const move = Math.min(step, L)
        d = { x: d.x + (dx / L) * move, y: d.y + (dy / L) * move }
      }

      if (!tooWet) {
        if (m === "chasing") {
          moveToward(b)
          if (dist(d, b) <= pickupRadius) {
            modeRef.current = "returning"
            setMode("returning")
          }
        }

        if (m === "returning") {
          const cur = cursorRef.current
          moveToward(cur)
          b = { x: d.x + 22, y: d.y + 6 }
          bv = { x: 0, y: 0 }
          if (dist(d, cur) <= returnRadius) {
            modeRef.current = "idle"
            setMode("idle")
            b = { x: cur.x + 18, y: cur.y + 18 }
          }
        }
      } else {
        // if too wet, freeze in place (keep mode as-is, you can dry to continue)
        bv = bv
      }

      // clamp dog to viewport
      d = { x: clamp(d.x, 20, w - 20), y: clamp(d.y, 20, groundY) }

      // estimate speed for animation + facing
      const lastDog = lastDogRef.current
      const v = Math.hypot(d.x - lastDog.x, d.y - lastDog.y) / Math.max(dt, 1e-6)
      lastDogRef.current = d

      const running = v > 40 && !tooWet
      const runAmt = clamp((v - 40) / 500, 0, 1)
      setRunAmount(running ? runAmt : 0)

      if (Math.abs(d.x - lastDog.x) > 0.5) setFacing(d.x - lastDog.x >= 0 ? 1 : -1)

      const sec = t / 1000
      const wag = Math.sin(sec * Math.PI * 2 * (running ? 7 : 3)) * (running ? 26 : 16)
      setTailAngle(tooWet ? 0 : wag) // sad wet tail droops

      setRunPhase((sec * (running ? 14 : 6)) % (Math.PI * 2))
      setCapePhase((sec * (running ? 10 : 4)) % (Math.PI * 2))

      // commit
      dogPosRef.current = d
      ballPosRef.current = b
      ballVelRef.current = bv

      setDogPos(d)
      setBallPos(b)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const throwBall = (target: Vec) => {
    // if too wet, ignore throws
    if (wetRef.current >= WET_STOP) return

    const start = dogPosRef.current
    const dx = target.x - start.x
    const dy = target.y - start.y
    const d = Math.hypot(dx, dy)

    const time = clamp(d / 900, 0.35, 0.9)
    const vx = dx / time
    const vy = dy / time - 720

    ballPosRef.current = { x: start.x, y: start.y }
    ballVelRef.current = { x: vx, y: vy }

    setBallVisible(true)
    setBallPos({ x: start.x, y: start.y })
    modeRef.current = "ball_flying"
    setMode("ball_flying")
  }

  // cute bounce + leg swing
  const bounce = Math.sin(runPhase) * 6 * runAmount
  const legSwing = Math.sin(runPhase) * 18 * runAmount
  const legSwing2 = Math.sin(runPhase + Math.PI) * 18 * runAmount
  const capeWave = Math.sin(capePhase) * (12 + 10 * runAmount)

  const dogTransform = useMemo(() => {
    return `translate(${dogPos.x - 60}px, ${dogPos.y - 60 + bounce}px) scale(${facing}, 1)`
  }, [dogPos.x, dogPos.y, bounce, facing])

  const tooWet = wetness >= WET_STOP

  return (
    <main
      className="min-h-screen overflow-hidden select-none bg-sky-50"
      onPointerDown={(e) => {
        // left click throws
        if (e.button === 0) throwBall({ x: e.clientX, y: e.clientY })
        // right click starts dryer
        if (e.button === 2) setDrying(true)
      }}
      onPointerUp={(e) => {
        if (e.button === 2) setDrying(false)
      }}
    >
      {/* rain overlay */}
      <Rain />

      <div className="fixed left-0 top-0 p-4 text-sm">
        <div className="opacity-70">Left click: throw • Right click: blow dry</div>
        <div className="mt-2 w-56 h-3 rounded bg-black/10 overflow-hidden">
          <div
            className="h-full rounded bg-blue-600/70"
            style={{ width: `${wetness}%` }}
          />
        </div>
        <div className="opacity-70 mt-1">
          Wetness: {Math.round(wetness)}% {tooWet ? "(too wet to move)" : ""}
        </div>
      </div>

      {/* ball */}
      {ballVisible && (
        <div
          className="fixed w-4 h-4 rounded-full bg-red-500 shadow"
          style={{ transform: `translate(${ballPos.x - 8}px, ${ballPos.y - 8}px)` }}
        />
      )}

      {/* dryer visuals */}
      {drying && (
        <>
          <div
            className="fixed text-3xl"
            style={{ transform: `translate(${cursorRef.current.x + 12}px, ${cursorRef.current.y + 8}px)` }}
          >
            💨
          </div>
          <div
            className="fixed text-3xl"
            style={{ transform: `translate(${cursorRef.current.x - 36}px, ${cursorRef.current.y - 18}px)` }}
          >
            🧴
          </div>
          {/* wind cone */}
          <div
            className="fixed pointer-events-none"
            style={{
              left: cursorRef.current.x - 10,
              top: cursorRef.current.y - 10,
              width: 220,
              height: 120,
              transform: "rotate(-10deg)",
              background:
                "radial-gradient(closest-side, rgba(255,255,255,0.45), rgba(255,255,255,0))",
              filter: "blur(2px)",
            }}
          />
        </>
      )}

      {/* dog */}
      <div className="fixed will-change-transform" style={{ transform: dogTransform }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ opacity: tooWet ? 0.85 : 1 }}>
          {/* CAPE (behind dog) */}
          <g transform={`translate(44 52) rotate(${-18 - capeWave} 0 0)`} opacity={tooWet ? 0.85 : 0.95}>
            <path
              d="M0 0 C -18 10, -28 30, -24 54 C -12 44, 6 42, 22 54 C 16 30, 14 14, 0 0 Z"
              fill="#ef4444"
            />
            <path
              d="M0 0 C -14 10, -22 28, -18 50 C -8 40, 6 40, 18 50 C 12 28, 10 14, 0 0 Z"
              fill="#b91c1c"
              opacity="0.55"
            />
            <circle cx="6" cy="6" r="4" fill="#fbbf24" />
          </g>

          {/* tail wag (droops when too wet) */}
          <g transform={`rotate(${tailAngle} 90 78)`}>
            <path
              d="M92 78 C 108 70, 114 82, 108 92 C 102 90, 96 86, 92 78 Z"
              fill="#e8c48c"
            />
          </g>

          {/* body */}
          <ellipse cx="60" cy="78" rx="40" ry="30" fill="#f5d6a1" />

          {/* legs */}
          <g opacity={tooWet ? 0.9 : 1}>
            <g transform={`rotate(${legSwing} 46 92)`}>
              <ellipse cx="46" cy="105" rx="8" ry="6" fill="#e8c48c" />
              <rect x="40" y="88" width="12" height="20" rx="6" fill="#f0cfa0" opacity="0.9" />
            </g>
            <g transform={`rotate(${legSwing2} 74 92)`}>
              <ellipse cx="74" cy="105" rx="8" ry="6" fill="#e8c48c" />
              <rect x="68" y="88" width="12" height="20" rx="6" fill="#f0cfa0" opacity="0.9" />
            </g>
          </g>

          {/* head */}
          <circle cx="60" cy="45" r="28" fill="#f5d6a1" />

          {/* ears */}
          <ellipse cx="35" cy="30" rx="12" ry="18" fill="#e8c48c" />
          <ellipse cx="85" cy="30" rx="12" ry="18" fill="#e8c48c" />

          {/* eyes (sad when too wet) */}
          <circle cx="50" cy="45" r="4" fill="#222" />
          <circle cx="70" cy="45" r="4" fill="#222" />
          {tooWet && (
            <>
              <path d="M44 52 Q50 48 56 52" stroke="#222" strokeWidth="2" fill="none" />
              <path d="M64 52 Q70 48 76 52" stroke="#222" strokeWidth="2" fill="none" />
            </>
          )}

          {/* nose */}
          <circle cx="60" cy="55" r="3" fill="#444" />

          {/* mouth */}
          <path d="M55 60 Q60 65 65 60" stroke="#444" strokeWidth="2" fill="none" />

          {/* tiny chest emblem */}
          <g transform="translate(60 72)">
            <path d="M0 -6 L4 2 L0 6 L-4 2 Z" fill="#60a5fa" opacity="0.9" />
          </g>

          {/* wet drops */}
          {wetness > 40 && (
            <>
              <circle cx="30" cy="70" r="2" fill="#60a5fa" opacity="0.9" />
              <circle cx="92" cy="60" r="2" fill="#60a5fa" opacity="0.9" />
              <circle cx="78" cy="92" r="2" fill="#60a5fa" opacity="0.9" />
            </>
          )}
        </svg>
      </div>
    </main>
  )
}

function Rain() {
  // CSS-only rain: 3 layers for density
  const layer = (opacity: number, duration: number) => (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity,
        backgroundImage:
          "repeating-linear-gradient(120deg, rgba(59,130,246,0.55) 0 1px, rgba(59,130,246,0) 1px 14px)",
        backgroundSize: "240px 240px",
        animation: `rainMove ${duration}s linear infinite`,
      }}
    />
  )

  return (
    <>
      <style jsx global>{`
        @keyframes rainMove {
          from {
            transform: translateY(-240px);
          }
          to {
            transform: translateY(240px);
          }
        }
      `}</style>
      <div className="fixed inset-0 overflow-hidden">
        {layer(0.18, 0.7)}
        {layer(0.12, 1.1)}
        {layer(0.08, 1.6)}
      </div>
    </>
  )
}
