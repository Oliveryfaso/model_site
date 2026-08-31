/// <reference lib="dom" />

import { spawn, type ChildProcess } from "node:child_process"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium, type BrowserContext, type Page } from "@playwright/test"
import { exhibits } from "../src/content/exhibits"
import { finalizeCaptureRun } from "./capture-cleanup"

const host = "127.0.0.1"
const port = 4174
const origin = `http://${host}:${port}`
const projectRoot = fileURLToPath(new URL("..", import.meta.url))
const shareDirectory = join(projectRoot, "public", "share")

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForServer(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 20_000
  let spawnError: Error | undefined
  const onError = (error: Error) => {
    spawnError = error
  }
  child.once("error", onError)

  try {
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error("The share-card Vite server exited before it became ready")
      }

      try {
        const response = await fetch(`${origin}/`)
        if (response.ok) return
      } catch {
        // The task-owned server is still starting.
      }

      await delay(150)
    }

    throw new Error(`Timed out waiting for the share-card server at ${origin}`)
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
    throw new Error("The task-owned Vite process group did not exit")
  }
}

async function waitForCardAssets(page: Page): Promise<void> {
  const card = page.locator("[data-share-card]")
  await card.waitFor({ state: "visible" })
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>("[data-share-card] img")).every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  )
}

async function captureCards(page: Page): Promise<void> {
  await mkdir(shareDirectory, { recursive: true })

  for (const exhibit of exhibits) {
    await page.goto(`${origin}/__share-card/${encodeURIComponent(exhibit.slug)}/`, {
      waitUntil: "networkidle",
    })
    await waitForCardAssets(page)
    await page.locator("[data-share-card]").screenshot({
      path: join(shareDirectory, `${exhibit.slug}.png`),
    })
  }
}

type ShareProbeWindow = Window & {
  __capturedShareData?: ShareData
  __capturedShareText?: string
}

type ShareProbeClipboard = Clipboard & { __shareProbe?: boolean }

async function verifyShareControls(page: Page): Promise<void> {
  await page.goto(`${origin}/exhibits/green-core/`, { waitUntil: "domcontentloaded" })
  await page.evaluate(`
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        __shareProbe: true,
        writeText: async (text) => { window.__capturedShareText = text; },
      },
    });
  `)
  const clipboardProbeInstalled = await page.evaluate(
    () => (navigator.clipboard as ShareProbeClipboard).__shareProbe === true,
  )
  if (!clipboardProbeInstalled) {
    throw new Error("Clipboard share probe was not installed before the exhibit loaded")
  }
  await page.getByRole("button", { name: "分享藏品" }).click()
  const copiedFeedback = page.getByText("链接已复制", { exact: true })
  await copiedFeedback.waitFor({ state: "visible" })
  const copiedUrl = await page.evaluate(
    () => (window as ShareProbeWindow).__capturedShareText,
  )
  if (copiedUrl !== `${origin}/exhibits/green-core/`) {
    throw new Error(`Clipboard fallback received an unexpected URL: ${copiedUrl ?? "none"}`)
  }
  await copiedFeedback.waitFor({ state: "hidden", timeout: 3_000 })

  const nativePage = await page.context().newPage()
  try {
    await nativePage.goto(`${origin}/exhibits/green-core/`, {
      waitUntil: "domcontentloaded",
    })
    await nativePage.evaluate(`
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data) => { window.__capturedShareData = data; },
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Native sharing should not use the clipboard");
          },
        },
      });
    `)
    await nativePage.getByRole("button", { name: "分享藏品" }).click()
    await nativePage.waitForFunction(
      () => (window as ShareProbeWindow).__capturedShareData !== undefined,
    )
    const nativeData = await nativePage.evaluate(
      () => (window as ShareProbeWindow).__capturedShareData,
    )
    if (
      nativeData?.title !== "翠核标本" ||
      nativeData.text !== "一枚被当作未知生命核心保存的绿色标本。" ||
      nativeData.url !== `${origin}/exhibits/green-core/`
    ) {
      throw new Error(`Native share received unexpected data: ${JSON.stringify(nativeData)}`)
    }
  } finally {
    await nativePage.close()
  }
}

async function main(): Promise<void> {
  const profileDirectory = await mkdtemp(join(tmpdir(), "digital-figure-gallery-share-cards-"))
  let vite: ChildProcess | undefined
  let browserContext: BrowserContext | undefined
  let page: Page | undefined
  let rejectInterruption: ((error: Error) => void) | undefined
  const interruption = new Promise<never>((_resolve, reject) => {
    rejectInterruption = reject
  })
  const onInterrupt = (signal: NodeJS.Signals) => {
    rejectInterruption?.(new Error(`Share-card capture interrupted by ${signal}`))
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
        env: { ...process.env, DIGITAL_FIGURE_SHARE_CAPTURE: "1" },
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
          viewport: { width: 1200, height: 630 },
          deviceScaleFactor: 1,
        })
        page = browserContext.pages()[0] ?? (await browserContext.newPage())
        await captureCards(page)
        await verifyShareControls(page)
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
    },
    async terminateServer() {
      if (vite) await terminateOwnedServer(vite)
    },
  })
}

await main()
