export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly errors?: Array<{ field: string; code: string }>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const conflict = (code: string, message: string) => new AppError(code, 409, message);
export const forbidden = (code = "PERMISSION_DENIED", message = "Permission denied") =>
  new AppError(code, 403, message);
export const notFound = (message = "Resource not found") =>
  new AppError("RESOURCE_NOT_FOUND", 404, message);
