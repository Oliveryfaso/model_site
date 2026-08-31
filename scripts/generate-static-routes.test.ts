import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import type { Exhibit } from "../src/content/types"
import { generateStaticRoutes } from "./generate-static-routes"

const temporaryDirectories: string[] = []

const exhibit: Exhibit = {
  slug: "sample-one",
  collectionNumber: "001",
  title: "样本一号",
  summary: "用于验证静态页面元数据的一件样本。",
  description: "完整介绍。",
  tags: ["样本"],
  cover: "/covers/sample-one.jpg",
  model: "/models/sample-one.glb",
  share: { image: "/share/sample-one.png" },
  presentation: {
    layout: "center-stage",
    scene: "warm-cabinet",
    palette: ["#263d1f", "#92b85c", "#b47b3e"],
    lightingPresets: ["warm"],
  },
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

describe("generateStaticRoutes", () => {
  it("writes route-specific metadata while preserving absolute asset paths", async () => {
    const distDir = await mkdtemp(join(tmpdir(), "digital-figure-gallery-"))
    temporaryDirectories.push(distDir)
    await mkdir(distDir, { recursive: true })
    await writeFile(
      join(distDir, "index.html"),
      `<!doctype html><html><head><!--app-meta-start--><title>电子手办收藏站</title><!--app-meta-end--></head><body><script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css" /></body></html>`,
    )

    await generateStaticRoutes({
      distDir,
      origin: "https://gallery.example",
      exhibits: [exhibit],
      siteTitle: "电子手办收藏站",
      siteDescription: "一个用于收藏与观赏数字角色模型的私人展馆。",
    })

    const generated = await readFile(join(distDir, "exhibits/sample-one/index.html"), "utf8")
    expect(generated).toContain("<title>样本一号 · 电子手办收藏站</title>")
    expect(generated).toContain('property="og:image" content="https://gallery.example/share/sample-one.png"')
    expect(generated).toContain('property="og:url" content="https://gallery.example/exhibits/sample-one/"')

    const about = await readFile(join(distDir, "about/index.html"), "utf8")
    expect(about).toContain('src="/assets/app.js"')
    expect(about).toContain('href="/assets/app.css"')
  })

  it("rejects a dot-segment slug without replacing the root template", async () => {
    const distDir = await mkdtemp(join(tmpdir(), "digital-figure-gallery-"))
    temporaryDirectories.push(distDir)
    const template = "<!--app-meta-start--><title>root template</title><!--app-meta-end-->"
    await writeFile(join(distDir, "index.html"), template)

    await expect(
      generateStaticRoutes({
        distDir,
        origin: "https://gallery.example",
        exhibits: [{ ...exhibit, slug: ".." }],
        siteTitle: "电子手办收藏站",
        siteDescription: "一个用于收藏与观赏数字角色模型的私人展馆。",
      }),
    ).rejects.toThrow('Invalid exhibit slug: ..')

    await expect(readFile(join(distDir, "index.html"), "utf8")).resolves.toBe(template)
  })

  it.each([
    ["duplicate start marker", "<!--app-meta-start--><!--app-meta-start--><!--app-meta-end-->"],
    ["duplicate end marker", "<!--app-meta-start--><!--app-meta-end--><!--app-meta-end-->"],
  ])("rejects a template with a %s", async (_caseName, template) => {
    const distDir = await mkdtemp(join(tmpdir(), "digital-figure-gallery-"))
    temporaryDirectories.push(distDir)
    await writeFile(join(distDir, "index.html"), template)

    await expect(
      generateStaticRoutes({
        distDir,
        origin: "https://gallery.example",
        exhibits: [],
        siteTitle: "电子手办收藏站",
        siteDescription: "一个用于收藏与观赏数字角色模型的私人展馆。",
      }),
    ).rejects.toThrow("Expected one correctly ordered app metadata region")
  })
})
