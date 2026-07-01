export class OcularError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "OcularError";
  }
}

export function toErrorResult(error: unknown): { error: { code: string; message: string } } {
  if (error instanceof OcularError) {
    return { error: { code: error.code, message: error.message } };
  }

  if (error instanceof Error) {
    return { error: { code: "OCULAR_ERROR", message: error.message } };
  }

  return { error: { code: "OCULAR_ERROR", message: "Unknown error" } };
}
