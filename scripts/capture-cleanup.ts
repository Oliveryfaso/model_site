export type CaptureCleanupOperations = {
  closePage(): Promise<void>
  closeBrowserContext(): Promise<void>
  removeProfile(): Promise<void>
  terminateServer(): Promise<void>
}

export async function finalizeCaptureRun(
  primaryError: unknown | undefined,
  operations: CaptureCleanupOperations,
): Promise<void> {
  const cleanupErrors: unknown[] = []

  for (const cleanup of [
    () => operations.closePage(),
    () => operations.closeBrowserContext(),
    () => operations.removeProfile(),
    () => operations.terminateServer(),
  ]) {
    try {
      await cleanup()
    } catch (error) {
      cleanupErrors.push(error)
    }
  }

  if (primaryError === undefined && cleanupErrors.length === 0) return
  if (primaryError !== undefined && cleanupErrors.length === 0) throw primaryError

  const errors = primaryError === undefined
    ? cleanupErrors
    : [primaryError, ...cleanupErrors]
  const message = primaryError === undefined
    ? "Share-card capture cleanup failed"
    : "Share-card capture failed and cleanup also failed"

  throw new AggregateError(
    errors,
    message,
    primaryError === undefined ? undefined : { cause: primaryError },
  )
}
