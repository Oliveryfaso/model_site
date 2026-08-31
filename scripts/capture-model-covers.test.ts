import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, sep } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  commitCapturedCovers,
  validateCaptureSafeFrame,
} from "./capture-model-covers"

const temporaryRoots: string[] = []
const fileNames = ["avocado.jpg", "antique-camera.jpg", "fox.jpg"] as const

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  )
})

async function makeCoverFixture() {
  const root = await mkdtemp(join(tmpdir(), "gallery-cover-commit-"))
  temporaryRoots.push(root)
  const stagingDirectory = join(root, "staging")
  const destinationDirectory = join(root, "covers")
  await Promise.all([
    mkdir(stagingDirectory, { recursive: true }),
    mkdir(destinationDirectory, { recursive: true }),
  ])
  await Promise.all(
    fileNames.flatMap((fileName) => [
      writeFile(join(stagingDirectory, fileName), `new:${fileName}`),
      writeFile(join(destinationDirectory, fileName), `old:${fileName}`),
    ]),
  )
  return { stagingDirectory, destinationDirectory }
}

describe("commitCapturedCovers", () => {
  it.each([2, 3])(
    "restores every old cover when replacement rename %s fails",
    async (failedReplacement) => {
      const { stagingDirectory, destinationDirectory } = await makeCoverFixture()
      let replacement = 0
      const injectedRename: typeof rename = async (from, to) => {
        if (String(from).startsWith(`${stagingDirectory}${sep}`)) {
          replacement += 1
          if (replacement === failedReplacement) {
            throw new Error(`injected replacement ${failedReplacement} failure`)
          }
        }
        await rename(from, to)
      }

      await expect(
        commitCapturedCovers(
          stagingDirectory,
          destinationDirectory,
          fileNames,
          injectedRename,
        ),
      ).rejects.toThrow(`injected replacement ${failedReplacement} failure`)

      await expect(
        Promise.all(
          fileNames.map((fileName) =>
            readFile(join(destinationDirectory, fileName), "utf8"),
          ),
        ),
      ).resolves.toEqual(fileNames.map((fileName) => `old:${fileName}`))
    },
  )
})

describe("validateCaptureSafeFrame", () => {
  it("accepts foreground bounds with at least three percent of image-height clearance", () => {
    expect(
      validateCaptureSafeFrame({
        width: 1600,
        height: 1200,
        minX: 40,
        minY: 36,
        maxX: 1559,
        maxY: 1163,
      }),
    ).toEqual({ top: 36, right: 40, bottom: 36, left: 40, minimum: 36 })
  })

  it.each([
    ["top", { minX: 40, minY: 35, maxX: 1559, maxY: 1163 }],
    ["right", { minX: 40, minY: 36, maxX: 1564, maxY: 1163 }],
    ["bottom", { minX: 40, minY: 36, maxX: 1559, maxY: 1164 }],
    ["left", { minX: 35, minY: 36, maxX: 1559, maxY: 1163 }],
  ])("rejects a foreground that violates the %s safe edge", (_edge, bounds) => {
    expect(() =>
      validateCaptureSafeFrame({ width: 1600, height: 1200, ...bounds }),
    ).toThrow("requires at least 36px on every edge")
  })
})
