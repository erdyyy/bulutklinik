/**
 * QR Paylaşım Modalı
 * ───────────────────
 * Analiz seansı için 24 saatlik paylaşım linki + QR kodu üretir.
 * Token: base64url( sessionId + ":" + expiryTimestamp )
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { X, Copy, Check, QrCode, Clock, Shield, ExternalLink } from 'lucide-react'

interface Props {
  sessionId: string
  sessionLabel: string
  onClose: () => void
}

function encodeToken(sessionId: string, expiryMs: number): string {
  const raw = `${sessionId}:${expiryMs}`
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export default function ShareQrModal({ sessionId, sessionLabel, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [expiry, setExpiry] = useState<Date | null>(null)

  useEffect(() => {
    const expiryMs = Date.now() + 24 * 60 * 60 * 1000  // 24 saat
    const token = encodeToken(sessionId, expiryMs)
    const base = window.location.origin
    const shareUrl = `${base}/report/${token}`
    setUrl(shareUrl)
    setExpiry(new Date(expiryMs))

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, shareUrl, {
        width: 220,
        margin: 2,
        color: { dark: '#0f766e', light: '#ffffff' },
      })
    }
  }, [sessionId])

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const expiryStr = expiry?.toLocaleString('tr-TR', {
    day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
  })

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-teal-600 to-emerald-600">
          <div className="flex items-center gap-2">
            <QrCode className="text-white" size={18} />
            <span className="font-bold text-white text-sm">Hastaya QR ile Paylaş</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">

          {/* Session label */}
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{sessionLabel}</span> için paylaşım linki
          </p>

          {/* QR code */}
          <div className="p-3 bg-white rounded-xl shadow-md border border-gray-100">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>

          {/* Instructions */}
          <div className="flex flex-col gap-1.5 w-full text-center">
            <p className="text-xs text-gray-500">Hasta QR kodu okutarak raporunu görebilir</p>
            <p className="text-xs text-gray-400">Giriş gerektirmez · Mobil uyumlu</p>
          </div>

          {/* URL + copy */}
          <div className="w-full bg-gray-50 rounded-xl p-3 flex items-center gap-2 border border-gray-200">
            <code className="text-[11px] text-gray-500 flex-1 truncate break-all">{url}</code>
            <button
              onClick={copyLink}
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              {copied ? <><Check size={12} /> Kopyalandı</> : <><Copy size={12} /> Kopyala</>}
            </button>
          </div>

          {/* Open in browser */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors"
          >
            <ExternalLink size={12} /> Tarayıcıda Önizle
          </a>

          {/* Expiry & security */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              <Clock size={12} className="flex-shrink-0" />
              <span>Link geçerlilik: {expiryStr} tarihine kadar (24 saat)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              <Shield size={12} className="flex-shrink-0" />
              <span>Şifreli token · Hasta kimlik doğrulaması gerekmez</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
