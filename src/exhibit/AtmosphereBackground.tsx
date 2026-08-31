import { useEffect, useRef } from "react"
import type { ExhibitPalette } from "../content/types"

export type AtmosphereBackgroundProps = {
  palette: ExhibitPalette
  motion: "edge-bloom"
}

const MAX_DPR = 2
const FOLD_COUNT = 6

function rgba(hex: string, alpha: number) {
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  return `rgb(${red} ${green} ${blue} / ${alpha})`
}

function drawAtmosphere(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: ExhibitPalette,
  elapsed: number,
) {
  const [base, primary, accent] = palette
  context.clearRect(0, 0, width, height)
  context.fillStyle = base
  context.fillRect(0, 0, width, height)
  context.globalCompositeOperation = "screen"

  for (let index = 0; index < FOLD_COUNT; index += 1) {
    const progress = (index + 0.5) / FOLD_COUNT
    const drift = Math.sin(elapsed * (0.000055 + index * 0.000006) + index * 1.7)
    const sway = width * (0.018 + index * 0.002) * drift
    const center = width * progress + sway
    const foldWidth = width * (0.16 + (index % 3) * 0.025)
    const color = index % 2 === 0 ? primary : accent
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, rgba(color, 0))
    gradient.addColorStop(0.42, rgba(color, 0.025))
    gradient.addColorStop(0.82, rgba(color, 0.115))
    gradient.addColorStop(1, rgba(color, 0))

    context.beginPath()
    context.moveTo(center - foldWidth, 0)
    context.bezierCurveTo(
      center - foldWidth * 0.45 + sway,
      height * 0.28,
      center - foldWidth * 0.72 - sway,
      height * 0.7,
      center - foldWidth * 0.24,
      height,
    )
    context.lineTo(center + foldWidth * 0.24, height)
    context.bezierCurveTo(
      center + foldWidth * 0.72 - sway,
      height * 0.7,
      center + foldWidth * 0.45 + sway,
      height * 0.28,
      center + foldWidth,
      0,
    )
    context.closePath()
    context.fillStyle = gradient
    context.fill()
  }

  const bloom = context.createRadialGradient(
    width * 0.84,
    height * 1.03,
    0,
    width * 0.84,
    height * 1.03,
    Math.max(width, height) * 0.68,
  )
  bloom.addColorStop(0, rgba(accent, 0.28))
  bloom.addColorStop(0.32, rgba(primary, 0.1))
  bloom.addColorStop(1, rgba(primary, 0))
  context.fillStyle = bloom
  context.fillRect(0, 0, width, height)
  context.globalCompositeOperation = "source-over"
}

export function AtmosphereBackground({ palette, motion }: AtmosphereBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let context: CanvasRenderingContext2D | null = null
    try {
      context = canvas.getContext("2d")
    } catch {
      return
    }
    if (!context || typeof context.setTransform !== "function") return

    let frame = 0
    let width = 0
    let height = 0
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      width = Math.max(1, Math.round(bounds.width))
      height = Math.max(1, Math.round(bounds.height))
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawAtmosphere(context, width, height, palette, 0)
    }

    const render = (time: number) => {
      drawAtmosphere(context, width, height, palette, time)
      frame = window.requestAnimationFrame(render)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    if (!reducedMotion && motion === "edge-bloom") frame = window.requestAnimationFrame(render)

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [motion, palette])

  return (
    <canvas
      ref={canvasRef}
      className="atmosphere-background"
      aria-hidden="true"
      style={
        {
          "--atmosphere-base": palette[0],
          "--atmosphere-primary": palette[1],
          "--atmosphere-accent": palette[2],
        } as React.CSSProperties
      }
    />
  )
}
