import { z } from "zod";
import { nonEmpty, uuid } from "@/common/dto/primitives";

export const loginDto = z.strictObject({ email: z.email().max(254), password: z.string().min(12).max(128), tenantSlug: z.string().trim().min(3).max(80).optional(), mfaCode: z.string().regex(/^\d{6}$/).optional(), deviceFingerprint: z.string().trim().max(255).optional() });
export const refreshDto = z.strictObject({ refreshToken: z.string().min(32).max(2048).optional(), deviceFingerprint: z.string().trim().max(255).optional() });
export const forgotPasswordDto = z.strictObject({ email: z.email().max(254) });
export const resetPasswordDto = z.strictObject({ token: z.string().min(32).max(2048), password: z.string().min(12).max(128) });
export const mfaChallengeDto = z.strictObject({ challengeId: uuid, code: z.string().regex(/^\d{6}$/) });
export const inviteUserDto = z.strictObject({ email: z.email().max(254), firstName: nonEmpty(100), lastName: nonEmpty(100), roleId: uuid, campusId: uuid.optional() });
export const acceptInvitationDto = z.strictObject({ token: z.string().min(32).max(2048), password: z.string().min(12).max(128), firstName: nonEmpty(100), lastName: nonEmpty(100) });
export const verifyMfaDto = z.strictObject({ code: z.string().regex(/^\d{6}$/) });
export const disableMfaDto = z.strictObject({ password: z.string().min(12).max(128), code: z.string().min(6).max(128) });

export type LoginDto = z.infer<typeof loginDto>;
export type InviteUserDto = z.infer<typeof inviteUserDto>;
