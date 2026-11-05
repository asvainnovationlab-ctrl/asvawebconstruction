import { z } from 'zod';
import { ROLE_KEYS } from '../permissions.js';
import { checkPasswordStrength } from '../utils.js';
import { emailSchema, idSchema, optionalText, requiredText } from './common.js';

export const passwordSchema = z
  .string()
  .max(128, 'Use at most 128 characters')
  .superRefine((value, ctx) => {
    for (const message of checkPasswordStrength(value)) ctx.addIssue({ code: 'custom', message });
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a new password' });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  name: requiredText(100, 'Name'),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const createUserSchema = z.object({
  email: emailSchema,
  name: requiredText(100, 'Name'),
  roles: z.array(z.enum(ROLE_KEYS)).min(1, 'Assign at least one role'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: requiredText(100, 'Name').optional(),
  isActive: z.boolean().optional(),
  roles: z.array(z.enum(ROLE_KEYS)).min(1, 'Assign at least one role').optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.string().min(1).max(100)).max(200),
  description: optionalText(300).optional(),
});
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;

export const userIdParam = z.object({ id: idSchema });

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: { key: string; name: string }[];
  permissions: string[];
  lastLoginAt: string | null;
}
