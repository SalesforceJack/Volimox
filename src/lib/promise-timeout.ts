export class PromiseTimeoutError extends Error {
  readonly code = "ETIMEDOUT"

  constructor(message: string) {
    super(message)
    this.name = "TimeoutError"
  }
}

export function isPromiseTimeoutError(error: unknown): error is PromiseTimeoutError {
  return error instanceof PromiseTimeoutError
    || (error instanceof Error && error.name === "TimeoutError" && (error as Error & { code?: unknown }).code === "ETIMEDOUT")
}

/** Rejects if a dependency promise does not settle within the requested deadline. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new PromiseTimeoutError(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(id)
        resolve(value)
      },
      (error) => {
        clearTimeout(id)
        reject(error)
      },
    )
  })
}
