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

  const [tailAngle, setTailAngle] = useState(0) // degrees
  const [runPhase, setRunPhase] = useState(0) // radians
  const [capePhase, setCapePhase] = useState(0) // radians
  const [facing, setFacing] = useState<1 | -1>(1)
  const [runAmount, setRunAmount] = useState(0) // 0..1

  const dogPosRef = useRef<Vec>({ x: 0, y: 0 })
  const ballPosRef = useRef<Vec>({ x: 0, y: 0 })
  const ballVelRef = useRef<Vec>({ x: 0, y: 0 })
  const modeRef = useRef<Mode>("idle")

  const cursorRef = useRef<Vec>({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const lastTRef = useRef<number>(0)
  const lastDogRef = useRef<Vec>({ x: 0, y: 0 })

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

  // track cursor
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  // animation loop: movement + wag + run + cape
  useEffect(() => {
    const gravity = 1800
    const groundPad = 32
    const dogSpeed = 560
    const pickupRadius = 30
    const returnRadius = 28

    const tick = (t: number) => {
      const last = lastTRef.current || t
      const dt = clamp((t - last) / 1000, 0, 0.05)
      lastTRef.current = t

      const w = window.innerWidth
      const h = window.innerHeight
      const groundY = h - groundPad

      let d = dogPosRef.current
      let b = ballPosRef.current
      let bv = ballVelRef.current
      const m = modeRef.current

      // ball physics
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

      // dog behavior
      const moveToward = (to: Vec) => {
        const dx = to.x - d.x
        const dy = to.y - d.y
        const L = Math.hypot(dx, dy) || 1
        const step = dogSpeed * dt
        const move = Math.min(step, L)
        d = { x: d.x + (dx / L) * move, y: d.y + (dy / L) * move }
      }

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
        // carry ball on the mouth side
        b = { x: d.x + 22, y: d.y + 6 }
        bv = { x: 0, y: 0 }
        if (dist(d, cur) <= returnRadius) {
          modeRef.current = "idle"
          setMode("idle")
          b = { x: cur.x + 18, y: cur.y + 18 }
        }
      }

      // clamp dog to viewport
      d = { x: clamp(d.x, 20, w - 20), y: clamp(d.y, 20, groundY) }

      // estimate dog speed for animation + facing
      const lastDog = lastDogRef.current
      const v = Math.hypot(d.x - lastDog.x, d.y - lastDog.y) / Math.max(dt, 1e-6) // px/s
      lastDogRef.current = d

      const running = v > 40
      const runAmt = clamp((v - 40) / 500, 0, 1)
      setRunAmount(runAmt)

      if (Math.abs(d.x - lastDog.x) > 0.5) setFacing(d.x - lastDog.x >= 0 ? 1 : -1)

      // wag, run legs, cape flap (time-based so it never "sticks")
      const sec = t / 1000
      const wag = Math.sin(sec * Math.PI * 2 * (running ? 7 : 3)) * (running ? 26 : 16)
      setTailAngle(wag)

      // run phase progresses faster as speed increases
      setRunPhase((sec * (running ? 14 : 6)) % (Math.PI * 2))
      setCapePhase((sec * (running ? 10 : 4)) % (Math.PI * 2))

      // commit
      dogPosRef.current = d
      ballPosRef.current = b
      ballVelRef.current = bv

      setDogPos(d)
      setBallPos(b)
      ballVelRef.current = bv

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const throwBall = (target: Vec) => {
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
    // flip around its own center by scaling X, then translate
    // we apply translate first in CSS by using a wrapper div
    return `translate(${dogPos.x - 60}px, ${dogPos.y - 60 + bounce}px) scale(${facing}, 1)`
  }, [dogPos.x, dogPos.y, bounce, facing])

  return (
    <main
      className="min-h-screen overflow-hidden select-none bg-sky-50"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        throwBall({ x: e.clientX, y: e.clientY })
      }}
    >
      <div className="fixed left-0 top-0 p-4 text-sm opacity-70">
        Left click to throw. Mode: {mode}
      </div>

      {/* ball */}
      {ballVisible && (
        <div
          className="fixed w-4 h-4 rounded-full bg-red-500 shadow"
          style={{ transform: `translate(${ballPos.x - 8}px, ${ballPos.y - 8}px)` }}
        />
      )}

      {/* dog */}
      <div className="fixed will-change-transform" style={{ transform: dogTransform }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* CAPE (behind dog) */}
          <g transform={`translate(44 52) rotate(${-18 - capeWave} 0 0)`}>
            <path
              d="M0 0 C -18 10, -28 30, -24 54 C -12 44, 6 42, 22 54 C 16 30, 14 14, 0 0 Z"
              fill="#ef4444"
              opacity="0.95"
            />
            <path
              d="M0 0 C -14 10, -22 28, -18 50 C -8 40, 6 40, 18 50 C 12 28, 10 14, 0 0 Z"
              fill="#b91c1c"
              opacity="0.55"
            />
            {/* cape clasp */}
            <circle cx="6" cy="6" r="4" fill="#fbbf24" />
          </g>

          {/* tail wag */}
          <g transform={`rotate(${tailAngle} 90 78)`}>
            <path
              d="M92 78 C 108 70, 114 82, 108 92 C 102 90, 96 86, 92 78 Z"
              fill="#e8c48c"
            />
          </g>

          {/* body */}
          <ellipse cx="60" cy="78" rx="40" ry="30" fill="#f5d6a1" />

          {/* legs (swing when running) */}
          <g>
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

          {/* eyes */}
          <circle cx="50" cy="45" r="4" fill="#222" />
          <circle cx="70" cy="45" r="4" fill="#222" />

          {/* nose */}
          <circle cx="60" cy="55" r="3" fill="#444" />

          {/* mouth */}
          <path d="M55 60 Q60 65 65 60" stroke="#444" strokeWidth="2" fill="none" />

          {/* tiny chest emblem */}
          <g transform="translate(60 72)">
            <path d="M0 -6 L4 2 L0 6 L-4 2 Z" fill="#60a5fa" opacity="0.9" />
          </g>
        </svg>
      </div>
    </main>
  )
}
