import { AppError, conflict, notFound } from "@/common/errors/app-error";
import { withDatabaseContext } from "@/database/tenant-transaction";
import type { BiometricEnrollmentDto, ConsentDto, DeviceDto } from "./dto";
import { encryptBiometricReference } from "./reference-crypto";

async function subjectExists(manager: import("typeorm").EntityManager, tenantId: string, type: string, id: string): Promise<boolean> {
  const table = type === "STUDENT" ? "students" : "employees";
  const [row] = await manager.query(`SELECT id FROM ${table} WHERE id=$1 AND tenant_id=$2 AND status='ACTIVE'`, [id, tenantId]);
  return Boolean(row);
}

export async function grantConsent(tenantId: string, actorId: string, input: ConsentDto) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    if (!await subjectExists(manager, tenantId, input.subjectType, input.subjectId)) throw new AppError("CONSENT_SUBJECT_INVALID", 422, "Consent subject is not active in this school");
    await manager.query(`UPDATE consent_records SET withdrawn_at=now() WHERE tenant_id=$1 AND subject_type=$2 AND subject_id=$3 AND purpose=$4 AND withdrawn_at IS NULL`, [tenantId, input.subjectType, input.subjectId, input.purpose]);
    const [row] = await manager.query(
      `INSERT INTO consent_records(tenant_id,subject_type,subject_id,purpose,basis,policy_version,granted_by,granted_at,expires_at,evidence_ref)
       VALUES($1,$2,$3,$4,$5,$6,$7,now(),$8,$9) RETURNING id,subject_type "subjectType",subject_id "subjectId",purpose,basis,policy_version "policyVersion",granted_at "grantedAt",expires_at "expiresAt"`,
      [tenantId, input.subjectType, input.subjectId, input.purpose, input.basis, input.policyVersion, actorId, input.expiresAt ?? null, input.evidenceRef ?? null],
    );
    await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,result,correlation_id) VALUES($1,'USER',$2,'CONSENT_GRANTED','CONSENT',$3,'SUCCESS',gen_random_uuid())`, [tenantId, actorId, row.id]);
    return row;
  }, "SERIALIZABLE");
}

export async function withdrawConsent(tenantId: string, actorId: string, consentId: string, reason: string) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    const [consent] = await manager.query(`UPDATE consent_records SET withdrawn_at=now() WHERE id=$1 AND tenant_id=$2 AND withdrawn_at IS NULL RETURNING id`, [consentId, tenantId]);
    if (!consent) throw notFound();
    const profiles = await manager.query(`UPDATE biometric_profiles SET status='REVOKED',revoked_at=now() WHERE consent_id=$1 AND tenant_id=$2 AND revoked_at IS NULL RETURNING id`, [consentId, tenantId]);
    if (profiles.length) await manager.query(`UPDATE biometric_profile_syncs SET status='PENDING',provider_ref=NULL,synced_at=NULL,last_error=NULL,updated_at=now() WHERE tenant_id=$1 AND profile_id=ANY($2::uuid[])`, [tenantId, profiles.map((profile: { id: string }) => profile.id)]);
    await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,reason,result,correlation_id) VALUES($1,'USER',$2,'CONSENT_WITHDRAWN','CONSENT',$3,$4,'SUCCESS',gen_random_uuid())`, [tenantId, actorId, consentId, reason]);
    return { id: consentId, status: "WITHDRAWN", revokedProfiles: profiles.length };
  }, "SERIALIZABLE");
}

export async function enrollBiometric(tenantId: string, actorId: string, input: BiometricEnrollmentDto) {
  try {
    return await withDatabaseContext({ tenantId }, async (manager) => {
      if (!await subjectExists(manager, tenantId, input.subjectType, input.subjectId)) throw new AppError("BIOMETRIC_SUBJECT_INVALID", 422, "Biometric subject is not active in this school");
      const [consent] = await manager.query(
        `SELECT id FROM consent_records WHERE id=$1 AND tenant_id=$2 AND subject_type=$3 AND subject_id=$4
          AND purpose='BIOMETRIC_ATTENDANCE' AND withdrawn_at IS NULL AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE`,
        [input.consentId, tenantId, input.subjectType, input.subjectId],
      );
      if (!consent) throw new AppError("BIOMETRIC_CONSENT_REQUIRED", 422, "Active biometric attendance consent is required");
      const [profile] = await manager.query(
        `INSERT INTO biometric_profiles(tenant_id,subject_type,subject_id,provider,modality,encrypted_reference,status,consent_id,enrolled_by,enrolled_at)
         VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8,now())
         RETURNING id,subject_type "subjectType",subject_id "subjectId",provider,modality,status,enrolled_at "enrolledAt"`,
        [tenantId, input.subjectType, input.subjectId, input.provider, input.modality, encryptBiometricReference(input.captureToken), input.consentId, actorId],
      );
      await manager.query(
        `INSERT INTO biometric_profile_syncs(tenant_id,profile_id,device_id,status)
         SELECT $1,$2,id,'PENDING' FROM biometric_devices WHERE tenant_id=$1 AND provider=$3 AND status='ACTIVE'
         ON CONFLICT(profile_id,device_id) DO NOTHING`,
        [tenantId, profile.id, input.provider],
      );
      await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,result,correlation_id) VALUES($1,'USER',$2,'BIOMETRIC_ENROLLED','BIOMETRIC_PROFILE',$3,'SUCCESS',gen_random_uuid())`, [tenantId, actorId, profile.id]);
      return profile;
    }, "SERIALIZABLE");
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") throw conflict("BIOMETRIC_PROFILE_EXISTS", "An active biometric profile already exists for this provider and modality");
    throw error;
  }
}

export async function revokeBiometric(tenantId: string, actorId: string, profileId: string, input: { reason: string; expectedStatus: string }) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    const [profile] = await manager.query(`UPDATE biometric_profiles SET status='REVOKED',revoked_at=now() WHERE id=$1 AND tenant_id=$2 AND status=$3 AND revoked_at IS NULL RETURNING id`, [profileId, tenantId, input.expectedStatus]);
    if (!profile) throw conflict("BIOMETRIC_PROFILE_STATE_CHANGED", "Biometric profile is missing or its status has changed");
    await manager.query(`UPDATE biometric_profile_syncs SET status='PENDING',provider_ref=NULL,synced_at=NULL,last_error=NULL,updated_at=now() WHERE profile_id=$1 AND tenant_id=$2`, [profileId, tenantId]);
    await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,reason,result,correlation_id) VALUES($1,'USER',$2,'BIOMETRIC_REVOKED','BIOMETRIC_PROFILE',$3,$4,'SUCCESS',gen_random_uuid())`, [tenantId, actorId, profileId, input.reason]);
    return { id: profileId, status: "REVOKED" };
  }, "SERIALIZABLE");
}

export async function listBiometricProfiles(tenantId: string, input: { subjectType?: string; subjectId?: string; status?: string }) {
  return withDatabaseContext({ tenantId }, (manager) => manager.query(
    `SELECT profile.id,profile.subject_type "subjectType",profile.subject_id "subjectId",profile.provider,profile.modality,profile.quality_score "qualityScore",profile.status,
            profile.enrolled_at "enrolledAt",profile.revoked_at "revokedAt",count(sync.id)::int "deviceSyncCount",count(sync.id) FILTER(WHERE sync.status='SYNCED')::int "syncedDeviceCount"
       FROM biometric_profiles profile LEFT JOIN biometric_profile_syncs sync ON sync.profile_id=profile.id AND sync.tenant_id=profile.tenant_id
      WHERE profile.tenant_id=$1 AND ($2::text IS NULL OR profile.subject_type=$2) AND ($3::uuid IS NULL OR profile.subject_id=$3) AND ($4::text IS NULL OR profile.status=$4)
      GROUP BY profile.id ORDER BY profile.created_at DESC LIMIT 500`,
    [tenantId, input.subjectType ?? null, input.subjectId ?? null, input.status ?? null],
  ));
}

export async function registerDevice(tenantId: string, actorId: string, input: DeviceDto) {
  try {
    return await withDatabaseContext({ tenantId }, async (manager) => {
      const [campus] = await manager.query(`SELECT id FROM campuses WHERE id=$1 AND tenant_id=$2 AND status='ACTIVE'`, [input.campusId, tenantId]);
      if (!campus) throw new AppError("DEVICE_CAMPUS_INVALID", 422, "Device campus is not active");
      const [device] = await manager.query(
        `INSERT INTO biometric_devices(tenant_id,campus_id,provider,serial_no,public_key,capabilities,firmware,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,'ACTIVE') RETURNING id,campus_id "campusId",provider,serial_no "serialNo",capabilities,firmware,status`,
        [tenantId, input.campusId, input.provider, input.serialNo, input.publicKey, input.capabilities, input.firmware ?? null],
      );
      await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,result,correlation_id) VALUES($1,'USER',$2,'DEVICE_REGISTERED','BIOMETRIC_DEVICE',$3,'SUCCESS',gen_random_uuid())`, [tenantId, actorId, device.id]);
      return device;
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") throw conflict("DEVICE_EXISTS", "A device with this provider and serial number already exists");
    throw error;
  }
}

export async function listDevices(tenantId: string) {
  return withDatabaseContext({ tenantId }, (manager) => manager.query(
    `SELECT device.id,device.campus_id "campusId",campus.name "campusName",device.provider,device.serial_no "serialNo",device.capabilities,device.firmware,device.status,device.last_seen_at "lastSeenAt",device.clock_drift_ms "clockDriftMs"
       FROM biometric_devices device JOIN campuses campus ON campus.id=device.campus_id AND campus.tenant_id=device.tenant_id
      WHERE device.tenant_id=$1 ORDER BY device.created_at DESC`, [tenantId],
  ));
}

export async function addDeviceCredential(tenantId: string, actorId: string, deviceId: string, input: { keyId: string; publicMaterial: string; notBefore: string; expiresAt?: string }) {
  if (input.expiresAt && input.expiresAt <= input.notBefore) throw new AppError("DEVICE_CREDENTIAL_RANGE_INVALID", 422, "Credential expiry must be after its activation time");
  return withDatabaseContext({ tenantId }, async (manager) => {
    const [device] = await manager.query(`SELECT id FROM biometric_devices WHERE id=$1 AND tenant_id=$2 AND status IN ('ACTIVE','PROVISIONED')`, [deviceId, tenantId]);
    if (!device) throw notFound();
    const [credential] = await manager.query(`INSERT INTO device_credentials(tenant_id,device_id,key_id,public_material,not_before,expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,key_id "keyId",not_before "notBefore",expires_at "expiresAt"`, [tenantId, deviceId, input.keyId, input.publicMaterial, input.notBefore, input.expiresAt ?? null]);
    await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,result,correlation_id) VALUES($1,'USER',$2,'DEVICE_CREDENTIAL_ADDED','DEVICE_CREDENTIAL',$3,'SUCCESS',gen_random_uuid())`, [tenantId, actorId, credential.id]);
    return credential;
  });
}

export async function assignDevice(tenantId: string, actorId: string, deviceId: string, input: { locationId: string; purpose: string; startsAt: string; endsAt?: string }) {
  return withDatabaseContext({ tenantId }, async (manager) => {
    const [valid] = await manager.query(`SELECT device.id FROM biometric_devices device JOIN locations location ON location.id=$2 AND location.tenant_id=device.tenant_id AND location.campus_id=device.campus_id AND location.status='ACTIVE' WHERE device.id=$1 AND device.tenant_id=$3 AND device.status='ACTIVE'`, [deviceId, input.locationId, tenantId]);
    if (!valid) throw new AppError("DEVICE_ASSIGNMENT_INVALID", 422, "Device and location must be active and belong to the same campus");
    const [current] = await manager.query(`SELECT id,starts_at "startsAt" FROM device_assignments WHERE tenant_id=$1 AND device_id=$2 AND purpose=$3 AND status='ACTIVE' AND ends_at IS NULL FOR UPDATE`, [tenantId, deviceId, input.purpose]);
    if (current && Date.parse(input.startsAt) <= new Date(current.startsAt).getTime()) throw new AppError("DEVICE_ASSIGNMENT_DATE_INVALID", 422, "New assignment must begin after the current assignment");
    if (current) await manager.query(`UPDATE device_assignments SET status='ENDED',ends_at=$2 WHERE id=$1`, [current.id, input.startsAt]);
    const [assignment] = await manager.query(`INSERT INTO device_assignments(tenant_id,device_id,location_id,purpose,starts_at,ends_at,status) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE') RETURNING id,location_id "locationId",purpose,starts_at "startsAt",ends_at "endsAt",status`, [tenantId, deviceId, input.locationId, input.purpose, input.startsAt, input.endsAt ?? null]);
    await manager.query(`INSERT INTO audit_logs(tenant_id,actor_type,actor_id,action,resource_type,resource_id,result,correlation_id) VALUES($1,'USER',$2,'DEVICE_ASSIGNED','DEVICE_ASSIGNMENT',$3,'SUCCESS',gen_random_uuid())`, [tenantId, actorId, assignment.id]);
    return assignment;
  }, "SERIALIZABLE");
}
