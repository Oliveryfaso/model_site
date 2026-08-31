/// <reference lib="dom" />

import { spawn, type ChildProcess } from "node:child_process"
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium, type BrowserContext, type Page } from "@playwright/test"
import { exhibits } from "../src/content/exhibits"
import { finalizeCaptureRun } from "./capture-cleanup"

const host = "127.0.0.1"
const port = 4175
const origin = `http://${host}:${port}`
const coverWidth = 1600
const coverHeight = 1200
const captureSafeAreaRatio = 0.03
const projectRoot = resolve(".")
const coverDirectory = join(projectRoot, "public", "covers")

export type CaptureForegroundBounds = {
  width: number
  height: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type CaptureSafeMargins = {
  top: number
  right: number
  bottom: number
  left: number
  minimum: number
}

export function validateCaptureSafeFrame(
  bounds: CaptureForegroundBounds,
): CaptureSafeMargins {
  const minimum = Math.ceil(bounds.height * captureSafeAreaRatio)
  const margins = {
    top: bounds.minY,
    right: bounds.width - 1 - bounds.maxX,
    bottom: bounds.height - 1 - bounds.maxY,
    left: bounds.minX,
    minimum,
  }
  if (
    margins.top < minimum ||
    margins.right < minimum ||
    margins.bottom < minimum ||
    margins.left < minimum
  ) {
    throw new Error(
      `Capture foreground requires at least ${minimum}px on every edge; ` +
        `received top ${margins.top}px, right ${margins.right}px, ` +
        `bottom ${margins.bottom}px, left ${margins.left}px`,
    )
  }
  return margins
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForServer(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000
  let spawnError: Error | undefined
  const onError = (error: Error) => {
    spawnError = error
  }
  child.once("error", onError)

  try {
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error("The cover-capture Vite server exited before it became ready")
      }

      try {
        const response = await fetch(`${origin}/`)
        if (response.ok) return
      } catch {
        // The task-owned server is still starting.
      }

      await delay(150)
    }

    throw new Error(`Timed out waiting for the cover-capture server at ${origin}`)
  } finally {
    child.off("error", onError)
  }
}

function childHasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

function waitForChildExit(child: ChildProcess, milliseconds: number): Promise<boolean> {
  if (childHasExited(child)) return Promise.resolve(true)

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.off("exit", onExit)
      resolve(false)
    }, milliseconds)
    const onExit = () => {
      clearTimeout(timeout)
      resolve(true)
    }
    child.once("exit", onExit)
  })
}

function signalOwnedProcessGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return

  try {
    if (process.platform === "win32") {
      child.kill(signal)
    } else {
      process.kill(-child.pid, signal)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error
  }
}

async function terminateOwnedServer(child: ChildProcess): Promise<void> {
  if (child.pid === undefined) return

  signalOwnedProcessGroup(child, "SIGTERM")
  if (await waitForChildExit(child, 5_000)) return

  signalOwnedProcessGroup(child, "SIGKILL")
  if (!(await waitForChildExit(child, 5_000))) {
    throw new Error("The task-owned cover-capture Vite process group did not exit")
  }
}

async function waitForSettledModel(page: Page): Promise<void> {
  const capture = page.locator("[data-cover-capture]")
  await capture.waitFor({ state: "visible" })
  await page.waitForFunction(() => {
    const experience = document.querySelector(
      "[data-cover-capture] [data-model-state]",
    ) as HTMLElement | null
    const cover = experience?.querySelector("[data-cover-hidden]") as HTMLElement | null
    return (
      experience?.dataset.modelState === "ready" &&
      cover?.dataset.coverHidden === "true" &&
      getComputedStyle(cover).display === "none"
    )
  }, undefined, { timeout: 60_000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
}

async function measureRenderedForeground(page: Page): Promise<CaptureForegroundBounds> {
  return page.locator(".model-experience__canvas canvas").evaluate(async (source) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    const webglCanvas = source as HTMLCanvasElement
    const pixelsCanvas = document.createElement("canvas")
    pixelsCanvas.width = webglCanvas.width
    pixelsCanvas.height = webglCanvas.height
    const context = pixelsCanvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("Could not inspect the cover WebGL canvas")
    context.drawImage(webglCanvas, 0, 0)
    const pixels = context.getImageData(
      0,
      0,
      pixelsCanvas.width,
      pixelsCanvas.height,
    ).data
    let minX = pixelsCanvas.width
    let minY = pixelsCanvas.height
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < pixelsCanvas.height; y += 1) {
      for (let x = 0; x < pixelsCanvas.width; x += 1) {
        if (pixels[(y * pixelsCanvas.width + x) * 4 + 3]! < 8) continue
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
    if (maxX < 0 || maxY < 0) {
      throw new Error("The cover WebGL canvas contained no visible foreground pixels")
    }
    const bounds = webglCanvas.getBoundingClientRect()
    const scaleX = bounds.width / pixelsCanvas.width
    const scaleY = bounds.height / pixelsCanvas.height
    return {
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      minX: Math.floor(minX * scaleX),
      minY: Math.floor(minY * scaleY),
      maxX: Math.ceil((maxX + 1) * scaleX) - 1,
      maxY: Math.ceil((maxY + 1) * scaleY) - 1,
    }
  })
}

export async function commitCapturedCovers(
  stagingDirectory: string,
  destinationDirectory: string,
  fileNames: readonly string[],
  renameFile: typeof rename = rename,
): Promise<void> {
  const backupDirectory = join(stagingDirectory, ".previous")
  const backedUp: string[] = []
  const installed: string[] = []
  await mkdir(backupDirectory, { recursive: true })

  try {
    for (const fileName of fileNames) {
      await renameFile(
        join(destinationDirectory, fileName),
        join(backupDirectory, fileName),
      )
      backedUp.push(fileName)
    }

    for (const fileName of fileNames) {
      await renameFile(
        join(stagingDirectory, fileName),
        join(destinationDirectory, fileName),
      )
      installed.push(fileName)
    }
  } catch (primaryError) {
    const rollbackErrors: unknown[] = []
    for (const fileName of [...installed].reverse()) {
      try {
        await renameFile(
          join(destinationDirectory, fileName),
          join(stagingDirectory, fileName),
        )
      } catch (error) {
        rollbackErrors.push(error)
      }
    }
    for (const fileName of [...backedUp].reverse()) {
      try {
        await renameFile(
          join(backupDirectory, fileName),
          join(destinationDirectory, fileName),
        )
      } catch (error) {
        rollbackErrors.push(error)
      }
    }

    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [primaryError, ...rollbackErrors],
        "Cover commit failed and rollback also failed",
        { cause: primaryError },
      )
    }
    throw primaryError
  } finally {
    await rm(backupDirectory, { force: true, recursive: true })
  }
}

async function captureCovers(page: Page, stagingDirectory: string): Promise<void> {
  await mkdir(stagingDirectory, { recursive: true })

  for (const exhibit of exhibits) {
    await page.goto(
      `${origin}/exhibits/${encodeURIComponent(exhibit.slug)}/?capture=cover`,
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    )
    await waitForSettledModel(page)

    const capture = page.locator("[data-cover-capture]")
    const box = await capture.boundingBox()
    if (!box || Math.round(box.width) !== coverWidth || Math.round(box.height) !== coverHeight) {
      throw new Error(
        `${exhibit.slug} capture target was ${box?.width ?? 0}×${box?.height ?? 0}; expected ${coverWidth}×${coverHeight}`,
      )
    }

    const margins = validateCaptureSafeFrame(await measureRenderedForeground(page))

    const fileName = basename(exhibit.cover)
    await capture.screenshot({
      path: join(stagingDirectory, fileName),
      type: "jpeg",
      quality: 84,
      animations: "disabled",
    })
    console.log(
      `[cover-capture] ${fileName}: ${coverWidth}×${coverHeight}; ` +
        `safe margins top ${margins.top}px, right ${margins.right}px, ` +
        `bottom ${margins.bottom}px, left ${margins.left}px`,
    )
  }

  await mkdir(coverDirectory, { recursive: true })
  await commitCapturedCovers(
    stagingDirectory,
    coverDirectory,
    exhibits.map((exhibit) => basename(exhibit.cover)),
  )
}

async function main(): Promise<void> {
  await mkdir(coverDirectory, { recursive: true })
  const profileDirectory = await mkdtemp(join(tmpdir(), "digital-figure-gallery-covers-"))
  const stagingDirectory = await mkdtemp(join(coverDirectory, ".capture-"))
  let vite: ChildProcess | undefined
  let browserContext: BrowserContext | undefined
  let page: Page | undefined
  let rejectInterruption: ((error: Error) => void) | undefined
  const interruption = new Promise<never>((_resolve, reject) => {
    rejectInterruption = reject
  })
  const onInterrupt = (signal: NodeJS.Signals) => {
    rejectInterruption?.(new Error(`Cover capture interrupted by ${signal}`))
  }
  const onSigint = () => onInterrupt("SIGINT")
  const onSigterm = () => onInterrupt("SIGTERM")
  let primaryError: unknown | undefined

  try {
    vite = spawn(
      "npm",
      ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"],
      {
        cwd: projectRoot,
        detached: process.platform !== "win32",
        env: { ...process.env, DIGITAL_FIGURE_COVER_CAPTURE: "1" },
        stdio: "inherit",
      },
    )
    process.once("SIGINT", onSigint)
    process.once("SIGTERM", onSigterm)
    const ownedVite = vite
    await Promise.race([
      (async () => {
        await waitForServer(ownedVite)
        browserContext = await chromium.launchPersistentContext(profileDirectory, {
          headless: true,
          viewport: { width: coverWidth, height: coverHeight },
          deviceScaleFactor: 1,
        })
        page = browserContext.pages()[0] ?? (await browserContext.newPage())
        await page.emulateMedia({ reducedMotion: "no-preference" })
        await captureCovers(page, stagingDirectory)
      })(),
      interruption,
    ])
  } catch (error) {
    primaryError = error
  }

  process.off("SIGINT", onSigint)
  process.off("SIGTERM", onSigterm)
  await finalizeCaptureRun(primaryError, {
    async closePage() {
      await page?.close()
    },
    async closeBrowserContext() {
      await browserContext?.close()
    },
    async removeProfile() {
      await rm(profileDirectory, { force: true, recursive: true })
      await rm(stagingDirectory, { force: true, recursive: true })
    },
    async terminateServer() {
      if (vite) await terminateOwnedServer(vite)
    },
  })
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) await main()
