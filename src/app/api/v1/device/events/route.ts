import { env } from "@/config/env";
import { problem, success } from "@/common/http/response";
import { AppError } from "@/common/errors/app-error";
import { deviceEventInput } from "@/modules/attendance/schemas";
import { loadDeviceCredential, verifyDevicePublicSignature } from "@/modules/attendance/device-auth";
import { ingestDeviceEvent } from "@/modules/attendance/service";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const tenantId = request.headers.get("x-device-tenant-id");
    const deviceId = request.headers.get("x-device-id");
    const timestamp = request.headers.get("x-device-timestamp");
    const signature = request.headers.get("x-signature");
    const keyId = request.headers.get("x-device-key-id");
    if (!tenantId || !deviceId || !timestamp || !signature || !keyId) throw new AppError("DEVICE_AUTH_REQUIRED", 401, "Device authentication is required");
    const rawBody = await request.text();
    const publicMaterial=await loadDeviceCredential(tenantId,deviceId,keyId);
    verifyDevicePublicSignature(rawBody,timestamp,signature,publicMaterial,Date.now(),env().DEVICE_SIGNATURE_TOLERANCE_SECONDS);
    const result = await ingestDeviceEvent(tenantId, deviceId, rawBody, deviceEventInput.parse(JSON.parse(rawBody)));
    return success(request, result, result.status === "DUPLICATE" ? 200 : 202);
  } catch (error) { return problem(request, error); }
}
