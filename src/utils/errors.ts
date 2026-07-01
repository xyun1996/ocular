export class VisionBridgeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "VisionBridgeError";
  }
}

export function toErrorResult(error: unknown): { error: { code: string; message: string } } {
  if (error instanceof VisionBridgeError) {
    return { error: { code: error.code, message: error.message } };
  }

  if (error instanceof Error) {
    return { error: { code: "VISION_BRIDGE_ERROR", message: error.message } };
  }

  return { error: { code: "VISION_BRIDGE_ERROR", message: "Unknown vision bridge error" } };
}
