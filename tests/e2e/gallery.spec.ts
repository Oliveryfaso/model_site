import { expect, test, type Page } from "@playwright/test"

const exhibits = [
  {
    slug: "green-core",
    title: "翠核标本",
    summary: "一枚被当作未知生命核心保存的绿色标本。",
  },
  {
    slug: "silent-observer",
    title: "静默观测者",
    summary: "一台来自旧时代的观测装置，被重新安置在冷光舱室。",
  },
  {
    slug: "wilderness-messenger",
    title: "旷野信使",
    summary: "一只携带三段行动记忆、穿行于星雾之间的信使。",
  },
] as const

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      })),
    )
    .toEqual(await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.clientWidth,
    })))
}

async function readWebGLForegroundMargins(canvas: ReturnType<Page["locator"]>) {
  return canvas.evaluate(async (element) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    const source = element as HTMLCanvasElement
    const copy = document.createElement("canvas")
    copy.width = source.width
    copy.height = source.height
    const context = copy.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("2D canvas unavailable for foreground audit")
    context.drawImage(source, 0, 0)
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data
    let minX = copy.width
    let minY = copy.height
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < copy.height; y += 1) {
      for (let x = 0; x < copy.width; x += 1) {
        if (pixels[(y * copy.width + x) * 4 + 3]! < 8) continue
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
    if (maxX < minX || maxY < minY) throw new Error("WebGL foreground is empty")
    const rect = source.getBoundingClientRect()
    const scaleX = rect.width / copy.width
    const scaleY = rect.height / copy.height
    return {
      top: minY * scaleY,
      right: (copy.width - 1 - maxX) * scaleX,
      bottom: (copy.height - 1 - maxY) * scaleY,
      left: minX * scaleX,
    }
  })
}

type ViewerTerminalState = "ready" | "error" | "unavailable"

type CanvasLifecycleAudit = {
  current: number
  max: number
}

async function installCanvasLifecycleAudit(page: Page) {
  await page.evaluate(() => {
    const auditWindow = window as typeof window & {
      __galleryCanvasAudit?: CanvasLifecycleAudit
    }
    const countModelCanvases = () =>
      document.querySelectorAll(".model-experience__canvas canvas").length
    const initialCount = countModelCanvases()
    const audit = { current: initialCount, max: initialCount }
    auditWindow.__galleryCanvasAudit = audit

    new MutationObserver(() => {
      audit.current = countModelCanvases()
      audit.max = Math.max(audit.max, audit.current)
    }).observe(document.documentElement, { childList: true, subtree: true })
  })
}

async function readCanvasLifecycleAudit(page: Page): Promise<CanvasLifecycleAudit> {
  return page.evaluate(() => {
    const audit = (window as typeof window & {
      __galleryCanvasAudit?: CanvasLifecycleAudit
    }).__galleryCanvasAudit
    if (!audit) throw new Error("Canvas lifecycle audit was not installed")
    return { ...audit }
  })
}

async function expectCanvasLifecycleBound(page: Page) {
  const audit = await readCanvasLifecycleAudit(page)
  expect(
    await page.locator(".model-experience__canvas canvas").count(),
    "current WebGL Canvas count",
  ).toBeLessThanOrEqual(1)
  expect(audit.max, "maximum Canvas count observed during SPA navigation").toBeLessThanOrEqual(1)
}

async function readViewerTerminalState(page: Page): Promise<ViewerTerminalState | "pending"> {
  const experience = page.getByTestId("model-experience")
  const canvasCount = await page.locator(".model-experience__canvas canvas").count()
  const [state, readyVisible, errorVisible, unavailableVisible] = await Promise.all([
    experience.getAttribute("data-model-state"),
    page.getByText("三维模型已加载。", { exact: true }).isVisible(),
    page.getByText("三维模型加载失败。", { exact: true }).isVisible(),
    page
      .getByText("此设备无法使用三维查看器，正在显示封面图。", { exact: true })
      .isVisible(),
  ])

  if (state === "ready" && readyVisible && canvasCount === 1) return "ready"
  if (state === "error" && errorVisible && canvasCount <= 1) return "error"
  if (state === "unavailable" && unavailableVisible && canvasCount === 0) return "unavailable"
  return "pending"
}

async function waitForViewerTerminalState(page: Page) {
  const startedAt = Date.now()
  let terminalState: ViewerTerminalState | "pending" = "pending"

  await expect
    .poll(
      async () => {
        terminalState = await readViewerTerminalState(page)
        return terminalState
      },
      {
        message:
          "viewer must reach ready with exactly one Canvas, or a readable error/unavailable fallback",
        timeout: 20_000,
        intervals: [50, 100, 250, 500],
      },
    )
    .not.toBe("pending")

  return {
    state: terminalState as ViewerTerminalState,
    elapsedMs: Date.now() - startedAt,
  }
}

test("homepage renders one palette atmosphere without a WebGL canvas or overflow", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" })

  await expect(page).toHaveTitle("电子手办收藏站")
  await expect(page.getByRole("heading", { level: 1, name: "翠核标本" })).toBeVisible()
  await expect(page.getByText("馆藏目录 · 共 3 件", { exact: true })).toBeVisible()
  await expect(page.getByText("一枚被当作未知生命核心保存的绿色标本。", { exact: true })).toBeVisible()
  await expect(page.locator(".collection-page__atmosphere canvas")).toHaveCount(1)
  await expect(page.locator(".model-experience__canvas canvas")).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test("direct physical Fox URL clears a transient model failure and retries to ready", async ({
  page,
}) => {
  let modelRequestCount = 0
  await page.route("**/models/fox.glb", async (route) => {
    modelRequestCount += 1
    if (modelRequestCount === 1) {
      await route.abort("failed")
      return
    }
    await route.continue()
  })
  await page.goto("/exhibits/wilderness-messenger/", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { level: 1, name: "旷野信使" })).toBeVisible()
  const foxDisclosure = page.getByRole("button", { name: "查看藏品说明" })
  if (await foxDisclosure.isVisible()) await foxDisclosure.click()
  await expect(
    page.getByText("一只携带三段行动记忆、穿行于星雾之间的信使。", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("横向体态与多段骨骼动画用于验证沉浸构图、动画选择和移动端镜头边界。", {
      exact: true,
    }),
  ).toBeVisible()

  const retry = page.getByRole("button", { name: "重新加载模型" })
  await expect(retry).toBeVisible({ timeout: 20_000 })
  await retry.click()
  await expect
    .poll(() => readViewerTerminalState(page), {
      message: "retry must issue a fresh GLB request and reach ready",
      timeout: 20_000,
    })
    .toBe("ready")
  expect(modelRequestCount).toBe(2)
  await expect(page.locator(".model-experience__canvas canvas")).toHaveCount(1)
  await expectNoHorizontalOverflow(page)
})

test("sound is opt-in and no audio is requested before activation", async ({ page }) => {
  const audioRequests: string[] = []
  page.on("request", (request) => {
    if (/\.(?:mp3|wav)$/i.test(new URL(request.url()).pathname)) {
      audioRequests.push(request.url())
    }
  })

  await page.goto("/", { waitUntil: "networkidle" })
  const soundToggle = page.getByRole("button", { name: "开启声音", exact: true })
  await expect(soundToggle).toBeVisible()
  expect(audioRequests).toEqual([])

  const themeRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/audio/merry-christmas-mr-lawrence.mp3",
  )
  await soundToggle.click()
  await themeRequest
  await expect(page.getByRole("button", { name: "关闭声音", exact: true })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("digital-figure-gallery:sound-enabled")))
    .toBe("true")

  await page.addInitScript(() => {
    ;(window as typeof window & { __galleryRestorePlayCalls?: number })
      .__galleryRestorePlayCalls = 0
    HTMLMediaElement.prototype.play = function blockedRestore() {
      const restoreWindow = window as typeof window & { __galleryRestorePlayCalls?: number }
      restoreWindow.__galleryRestorePlayCalls =
        (restoreWindow.__galleryRestorePlayCalls ?? 0) + 1
      return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"))
    }
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.getByRole("button", { name: "开启声音", exact: true })).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __galleryRestorePlayCalls?: number })
          .__galleryRestorePlayCalls,
    ),
  ).toBe(1)
  expect(
    await page.evaluate(() =>
      localStorage.getItem("digital-figure-gallery:sound-enabled"),
    ),
  ).toBe("true")

  await page.addInitScript(() => {
    ;(window as typeof window & { __galleryRestorePlayCalls?: number })
      .__galleryRestorePlayCalls = 0
    HTMLMediaElement.prototype.play = function allowedRestore() {
      const restoreWindow = window as typeof window & { __galleryRestorePlayCalls?: number }
      restoreWindow.__galleryRestorePlayCalls =
        (restoreWindow.__galleryRestorePlayCalls ?? 0) + 1
      return Promise.resolve()
    }
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.getByRole("button", { name: "关闭声音", exact: true })).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __galleryRestorePlayCalls?: number })
          .__galleryRestorePlayCalls,
    ),
  ).toBe(1)
})

test("borderless viewer supports drag, wheel, transition fallback, and back navigation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop interaction contract")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    })
  })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.getByRole("link", { name: "进入翠核标本展厅" }).click()
  await expect(page).toHaveURL(/\/exhibits\/green-core\/$/)
  await expect.poll(() => readViewerTerminalState(page), { timeout: 20_000 }).toBe("ready")

  const viewer = page.locator(".exhibit-viewer")
  const viewerBox = await viewer.boundingBox()
  expect(viewerBox).not.toBeNull()
  expect(viewerBox!.x).toBeCloseTo(0, 0)
  expect(viewerBox!.y).toBeCloseTo(0, 0)
  expect(viewerBox!.width).toBeCloseTo(1440, 0)
  expect(viewerBox!.height).toBeGreaterThanOrEqual(900)
  await expect(viewer).toHaveCSS("border-top-width", "0px")
  await expect(viewer).toHaveCSS("border-radius", "0px")
  await expect(viewer).toHaveCSS("box-shadow", "none")

  const modelCanvas = viewer.locator(".model-experience__canvas canvas")
  await expect(modelCanvas).toHaveCount(1)
  await expect(modelCanvas).toHaveCSS("cursor", "grab")
  const canvasBox = await modelCanvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  expect(canvasBox!.x).toBeCloseTo(viewerBox!.x, 0)
  expect(canvasBox!.y).toBeCloseTo(viewerBox!.y, 0)
  expect(canvasBox!.width).toBeCloseTo(viewerBox!.width, 0)
  expect(canvasBox!.height).toBeGreaterThanOrEqual(viewerBox!.height)
  const foregroundMargins = await readWebGLForegroundMargins(modelCanvas)
  for (const [edge, margin] of Object.entries(foregroundMargins)) {
    expect(margin, `${edge} WebGL foreground margin`).toBeGreaterThanOrEqual(27)
  }
  const center = {
    x: canvasBox!.x + canvasBox!.width / 2,
    y: canvasBox!.y + canvasBox!.height / 2,
  }
  const beforeDrag = await viewer.screenshot({ animations: "disabled" })
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await expect(modelCanvas).toHaveCSS("cursor", "grabbing")
  await page.mouse.move(center.x + 150, center.y + 40, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const afterDrag = await viewer.screenshot({ animations: "disabled" })
  expect(afterDrag.equals(beforeDrag), "drag must visibly rotate the model").toBe(false)

  await page.mouse.move(center.x, center.y)
  await page.mouse.wheel(0, -420)
  await page.waitForTimeout(200)
  const afterWheel = await viewer.screenshot({ animations: "disabled" })
  expect(afterWheel.equals(afterDrag), "wheel must visibly zoom the model").toBe(false)

  await page.getByRole("link", { name: "返回馆藏" }).click()
  await expect(page).toHaveURL("http://127.0.0.1:4173/")
  await expect(page.getByRole("heading", { level: 1, name: "翠核标本" })).toBeVisible()
})

test("mobile stage keeps collapsed controls clear and expanded copy readable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile disclosure contract")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/exhibits/green-core/", { waitUntil: "domcontentloaded" })
  const terminalState = await waitForViewerTerminalState(page)
  if (terminalState.state === "ready") {
    const foregroundMargins = await readWebGLForegroundMargins(
      page.locator(".model-experience__canvas canvas"),
    )
    for (const [edge, margin] of Object.entries(foregroundMargins)) {
      expect(margin, `${edge} mobile WebGL foreground margin`).toBeGreaterThanOrEqual(12)
    }
  }

  const information = page.locator(".exhibit-layout__information")
  const toolbar = page.locator(".exhibit-layout__toolbar")
  const informationBox = await information.boundingBox()
  const toolbarBox = await toolbar.boundingBox()
  expect(informationBox).not.toBeNull()
  expect(toolbarBox).not.toBeNull()
  expect(informationBox!.y + informationBox!.height).toBeLessThanOrEqual(toolbarBox!.y)

  const disclosure = page.getByRole("button", { name: "查看藏品说明" })
  const copy = page.locator(".exhibit-information__body")
  await expect(disclosure).toHaveAttribute("aria-expanded", "false")
  await expect(copy).toHaveCSS("visibility", "hidden")
  await expect(page.locator(".exhibit-toolbar__secondary")).not.toHaveAttribute("open", "")

  await disclosure.click()
  await expect(disclosure).toHaveAttribute("aria-expanded", "true")
  await expect(copy).toHaveCSS("visibility", "visible")
  const copyBox = await copy.boundingBox()
  expect(copyBox).not.toBeNull()
  expect(copyBox!.height).toBeLessThanOrEqual(0.38 * 844 + 1)
  const copyBackground = await copy.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(copyBackground).not.toBe("rgba(0, 0, 0, 0)")
  await expectNoHorizontalOverflow(page)
})

test("unknown exhibit route has one heading and a working collection link", async ({ page }) => {
  await page.goto("/exhibits/unknown/", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
  await expect(page.getByRole("heading", { level: 1, name: "没有找到这件藏品" })).toBeVisible()
  const collectionLink = page.getByRole("link", { name: "回到馆藏" })
  await expect(collectionLink).toHaveAttribute("href", "/")
  await collectionLink.click()
  await expect(page).toHaveURL("http://127.0.0.1:4173/")
  await expect(page.getByRole("heading", { level: 1, name: "翠核标本" })).toBeVisible()
})

test("SPA navigation visits every exhibit twice without stacking canvases or overflowing", async ({
  page,
}, testInfo) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await installCanvasLifecycleAudit(page)

  for (let pass = 0; pass < 2; pass += 1) {
    for (const exhibit of exhibits) {
      await page.getByRole("link", { name: `进入${exhibit.title}展厅` }).click()
      await expect(page).toHaveURL(new RegExp(`/exhibits/${exhibit.slug}/$`))
      await expect(page.getByRole("heading", { level: 1, name: exhibit.title })).toBeVisible()
      const disclosure = page.getByRole("button", { name: "查看藏品说明" })
      if (await disclosure.isVisible()) await disclosure.click()
      await expect(page.getByText(exhibit.summary, { exact: true })).toBeVisible()
      const settlement = await waitForViewerTerminalState(page)
      expect(["ready", "unavailable"]).toContain(settlement.state)
      await expectCanvasLifecycleBound(page)
      console.info(
        `[viewer-settled] ${testInfo.project.name} pass=${pass + 1} ${exhibit.slug}: state=${settlement.state}, elapsed=${settlement.elapsedMs}ms`,
      )
      await expectNoHorizontalOverflow(page)

      await page.getByRole("link", { name: "返回馆藏" }).click()
      await expect(page).toHaveURL("http://127.0.0.1:4173/")
      await expect(page.getByRole("heading", { level: 1, name: "翠核标本" })).toBeVisible()
      await expect(page.locator(".collection-page__atmosphere canvas")).toHaveCount(1)
      await expect(page.locator(".model-experience__canvas canvas")).toHaveCount(0)
      await expectCanvasLifecycleBound(page)
      await expectNoHorizontalOverflow(page)
    }
  }
})

test("WebGL fallback keeps the exhibit readable and share control available", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function getContext(
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === "webgl" || contextId === "webgl2") return null
      return Reflect.apply(originalGetContext, this, [contextId, ...args])
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  await page.goto("/exhibits/green-core/", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { level: 1, name: "翠核标本" })).toBeVisible()
  await expect(
    page.getByText("此设备无法使用三维查看器，正在显示封面图。", { exact: true }),
  ).toBeVisible()
  await expect(page.locator(".model-experience__canvas canvas")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "分享藏品" })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test("keyboard users can reveal the skip link and move focus to main content", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })

  const skipLink = page.getByRole("link", { name: "跳到主要内容" })
  await page.keyboard.press("Tab")
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeVisible()
  await expect(skipLink).toHaveCSS("outline-style", "solid")
  await page.keyboard.press("Enter")
  await expect(page.locator("#main-content")).toBeFocused()
})
