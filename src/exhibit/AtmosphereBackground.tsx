import { useEffect, useRef } from "react"
import type { ExhibitPalette } from "../content/types"

export type AtmosphereBackgroundProps = {
  palette: ExhibitPalette
  motion: "edge-bloom"
  variant?: "exhibit" | "collection"
}

const MAX_DPR = 2

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
  variant: NonNullable<AtmosphereBackgroundProps["variant"]>,
) {
  const [base, primary, accent] = palette
  const isCollection = variant === "collection"
  const foldCount = isCollection ? 5 : 6
  context.clearRect(0, 0, width, height)
  context.fillStyle = isCollection ? rgba(base, 0.34) : base
  context.fillRect(0, 0, width, height)
  context.globalCompositeOperation = "screen"

  for (let index = 0; index < foldCount; index += 1) {
    const progress = (index + 0.5) / foldCount
    const speed = (0.000055 + index * 0.000006) * (isCollection ? 0.7 : 1)
    const drift = Math.sin(elapsed * speed + index * 1.7)
    const sway = width * (0.018 + index * 0.002) * drift
    const center = width * progress + sway
    const foldWidth = width * ((isCollection ? 0.21 : 0.16) + (index % 3) * 0.025)
    const color = index % 2 === 0 ? primary : accent
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, rgba(color, 0))
    gradient.addColorStop(0.42, rgba(color, isCollection ? 0.034 : 0.025))
    gradient.addColorStop(0.82, rgba(color, isCollection ? 0.12 : 0.115))
    gradient.addColorStop(1, rgba(color, isCollection ? 0.012 : 0))

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
  bloom.addColorStop(0, rgba(accent, isCollection ? 0.18 : 0.28))
  bloom.addColorStop(0.32, rgba(primary, isCollection ? 0.065 : 0.1))
  bloom.addColorStop(1, rgba(primary, 0))
  context.fillStyle = bloom
  context.fillRect(0, 0, width, height)
  context.globalCompositeOperation = "source-over"
}

export function AtmosphereBackground({
  palette,
  motion,
  variant = "exhibit",
}: AtmosphereBackgroundProps) {
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
      drawAtmosphere(context, width, height, palette, 0, variant)
    }

    const render = (time: number) => {
      drawAtmosphere(context, width, height, palette, time, variant)
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
  }, [motion, palette, variant])

  return (
    <canvas
      ref={canvasRef}
      className={`atmosphere-background atmosphere-background--${variant}`}
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
