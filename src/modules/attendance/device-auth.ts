import { createHash, createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { AppError } from "@/common/errors/app-error";

export function payloadHash(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function verifyDevicePublicSignature(rawBody:string,timestamp:string,signature:string,publicMaterial:string,now=Date.now(),toleranceSeconds=300):void{
  const instant=Date.parse(timestamp);if(!Number.isFinite(instant)||Math.abs(now-instant)>toleranceSeconds*1000)throw new AppError("SIGNATURE_EXPIRED",401,"Device signature timestamp is invalid");
  let valid=false;try{const key=createPublicKey(publicMaterial);const algorithm=key.asymmetricKeyType==="ed25519"||key.asymmetricKeyType==="ed448"?null:"sha256";valid=verify(algorithm,Buffer.from(`${timestamp}.${rawBody}`),key,Buffer.from(signature,"base64"));}catch{valid=false;}if(!valid)throw new AppError("SIGNATURE_INVALID",401,"Device signature is invalid");
}

export async function loadDeviceCredential(tenantId:string,deviceId:string,keyId:string):Promise<string>{const{withDatabaseContext}=await import("@/database/tenant-transaction");return withDatabaseContext({tenantId},async manager=>{const[row]=await manager.query(`SELECT credential.public_material FROM device_credentials credential JOIN biometric_devices device ON device.id=credential.device_id AND device.tenant_id=credential.tenant_id WHERE credential.tenant_id=$1 AND credential.device_id=$2 AND credential.key_id=$3 AND credential.revoked_at IS NULL AND credential.not_before<=now() AND (credential.expires_at IS NULL OR credential.expires_at>now()) AND device.status='ACTIVE'`,[tenantId,deviceId,keyId]);if(!row)throw new AppError("DEVICE_CREDENTIAL_INVALID",401,"Device credential is unavailable or expired");return row.public_material;});}

export function verifyDeviceSignature(rawBody: string, timestamp: string, signature: string, secret: string, now = Date.now(), toleranceSeconds = 300): void {
  const instant = Date.parse(timestamp);
  if (!Number.isFinite(instant) || Math.abs(now - instant) > toleranceSeconds * 1000) {
    throw new AppError("SIGNATURE_EXPIRED", 401, "Device signature timestamp is invalid");
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(signature, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new AppError("SIGNATURE_INVALID", 401, "Device signature is invalid");
  }
}
