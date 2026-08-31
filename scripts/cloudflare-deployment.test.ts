import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("Cloudflare deployment configuration", () => {
  it("deploys the built gallery as static SPA assets without framework auto-configuration", async () => {
    const configPath = resolve(process.cwd(), "wrangler.jsonc")
    const config = JSON.parse(await readFile(configPath, "utf8")) as {
      name?: string
      assets?: {
        directory?: string
        not_found_handling?: string
      }
    }

    expect(config.name).toBe("model-site")
    expect(config.assets).toEqual({
      directory: "./dist",
      not_found_handling: "single-page-application",
    })
  })
})
