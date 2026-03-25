/**
 * Before / After Drag Slider
 * ───────────────────────────
 * Öncesi/Sonrası fotoğraflarını sürüklenebilir bölücü ile karşılaştırır.
 * Mouse + Touch destekli.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'

interface Props {
  beforeSrc: string
  afterSrc:  string
  beforeLabel?: string
  afterLabel?:  string
  height?: number
}

export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Öncesi',
  afterLabel  = 'Sonrası',
  height = 320,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)   // 0–100 %
  const dragging = useRef(false)

  const calcPos = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.max(2, Math.min(98, pct)))
  }, [])

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    calcPos(e.clientX)
    e.preventDefault()
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) calcPos(e.clientX) }
    const onUp   = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [calcPos])

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true
    calcPos(e.touches[0].clientX)
  }
  useEffect(() => {
    const onMove = (e: TouchEvent) => { if (dragging.current) calcPos(e.touches[0].clientX) }
    const onEnd  = () => { dragging.current = false }
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend',  onEnd)
    return () => {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onEnd)
    }
  }, [calcPos])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl select-none cursor-col-resize"
      style={{ height }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* Before (full width, clipped on right) */}
      <img
        src={beforeSrc}
        alt="Öncesi"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* After (clipped on left via clipPath) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        <img
          src={afterSrc}
          alt="Sonrası"
          draggable={false}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      >
        {/* Handle */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center cursor-col-resize"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.35)' }}
        >
          <ArrowLeftRight size={16} className="text-gray-700" />
        </div>
      </div>

      {/* Labels */}
      <div
        className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide"
        style={{ background: 'rgba(0,0,0,0.55)', color: '#e5e7eb', backdropFilter: 'blur(4px)' }}
      >
        {beforeLabel}
      </div>
      <div
        className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide"
        style={{ background: 'rgba(16,185,129,0.65)', color: '#fff', backdropFilter: 'blur(4px)' }}
      >
        {afterLabel}
      </div>

      {/* Hint (fades after interaction) */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.45)', color: '#9ca3af', backdropFilter: 'blur(4px)',
                 opacity: position === 50 ? 1 : 0, transition: 'opacity 0.5s' }}
      >
        ← Sürükle →
      </div>
    </div>
  )
}
