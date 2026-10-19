import { ZodError } from "zod";
import { AppError } from "@/common/errors/app-error";

export function correlationId(request: Request): string {
  return request.headers.get("x-correlation-id") ?? crypto.randomUUID();
}

export function success(request: Request, data: unknown, status = 200): Response {
  return Response.json(
    { data, meta: { correlationId: correlationId(request), timestamp: new Date().toISOString() } },
    { status },
  );
}

export function problem(request: Request, error: unknown): Response {
  const id = correlationId(request);
  if (error instanceof ZodError) {
    return Response.json({
      type: "https://edupresence.local/problems/validation",
      title: "Validation failed",
      status: 422,
      code: "VALIDATION_FAILED",
      detail: "The request contains invalid fields.",
      errors: error.issues.map((issue) => ({ field: issue.path.join("."), code: issue.code })),
      correlationId: id,
    }, { status: 422 });
  }
  if (error instanceof AppError) {
    return Response.json({
      type: `https://edupresence.local/problems/${error.code.toLowerCase()}`,
      title: error.message,
      status: error.status,
      code: error.code,
      detail: error.message,
      errors: error.errors,
      correlationId: id,
    }, { status: error.status });
  }
  console.error(JSON.stringify({ level: "error", correlationId: id, message: "Unhandled request error" }));
  return Response.json({
    type: "https://edupresence.local/problems/internal",
    title: "Internal server error",
    status: 500,
    code: "INTERNAL_ERROR",
    detail: "The request could not be completed.",
    correlationId: id,
  }, { status: 500 });
}
