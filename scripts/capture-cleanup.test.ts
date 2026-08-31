import { describe, expect, it } from "vitest"
import { finalizeCaptureRun } from "./capture-cleanup"

describe("finalizeCaptureRun", () => {
  it("reports a browser cleanup failure after attempting every owned resource", async () => {
    const attempted: string[] = []
    const browserError = new Error("browser context still running")

    let thrown: unknown
    try {
      await finalizeCaptureRun(undefined, {
        async closePage() {
          attempted.push("page")
        },
        async closeBrowserContext() {
          attempted.push("browser")
          throw browserError
        },
        async removeProfile() {
          attempted.push("profile")
        },
        async terminateServer() {
          attempted.push("server")
        },
      })
    } catch (error) {
      thrown = error
    }

    expect(attempted).toEqual(["page", "browser", "profile", "server"])
    expect(thrown).toBeInstanceOf(AggregateError)
    expect((thrown as AggregateError).errors).toEqual([browserError])
  })

  it("preserves the primary capture error together with every cleanup error", async () => {
    const attempted: string[] = []
    const captureError = new Error("screenshot failed")
    const pageError = new Error("page close failed")
    const serverError = new Error("server termination failed")

    let thrown: unknown
    try {
      await finalizeCaptureRun(captureError, {
        async closePage() {
          attempted.push("page")
          throw pageError
        },
        async closeBrowserContext() {
          attempted.push("browser")
        },
        async removeProfile() {
          attempted.push("profile")
        },
        async terminateServer() {
          attempted.push("server")
          throw serverError
        },
      })
    } catch (error) {
      thrown = error
    }

    expect(attempted).toEqual(["page", "browser", "profile", "server"])
    expect(thrown).toBeInstanceOf(AggregateError)
    expect((thrown as AggregateError).errors).toEqual([
      captureError,
      pageError,
      serverError,
    ])
    expect((thrown as Error).cause).toBe(captureError)
  })
})
