import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  BUDGET_RANGES,
  LEAD_STATUSES,
  PREFERRED_CONTACT_METHODS,
  PROJECT_TYPES,
  SUBSCRIBER_STATUSES,
} from '../enums.js';
import {
  emailSchema,
  idSchema,
  listQuerySchema,
  optionalHttpUrl,
  optionalPhone,
  optionalText,
  phoneSchema,
  requiredText,
  spamFields,
} from './common.js';
import { TIMELINES } from '../enums.js';

const consentSchema = z.literal(true, { error: 'Please accept the privacy policy to continue' });

// ---------- Contact ----------
export const contactSubmissionSchema = z.object({
  name: requiredText(100, 'Name'),
  email: emailSchema,
  phone: optionalPhone,
  company: optionalText(120),
  subject: optionalText(150),
  message: requiredText(5000, 'Message').refine((v) => v.length >= 10, 'Please write at least 10 characters'),
  consent: consentSchema,
  ...spamFields,
});
export type ContactSubmissionInput = z.input<typeof contactSubmissionSchema>;

export const contactUpdateSchema = z.object({
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  internalNotes: optionalText(5000).optional(),
});
export type ContactUpdateInput = z.input<typeof contactUpdateSchema>;

export const contactQuerySchema = listQuerySchema.extend({
  status: z.enum(['unread', 'read', 'archived', 'active']).default('active'),
});

// ---------- Project inquiry ----------
export const projectInquiryStep1Schema = z.object({
  fullName: requiredText(100, 'Full name'),
  email: emailSchema,
  phone: phoneSchema,
  companyName: optionalText(120),
});

export const projectInquiryStep2Schema = z.object({
  projectType: z.enum(PROJECT_TYPES, { error: 'Choose a project type' }),
  description: requiredText(5000, 'Project description').refine((v) => v.length >= 20, 'Please describe the project in at least 20 characters'),
  hasExistingProduct: z.boolean().default(false),
  existingUrl: optionalHttpUrl,
});

export const projectInquiryStep3Schema = z.object({
  budgetRange: z.enum(BUDGET_RANGES, { error: 'Choose a budget range' }),
  timeline: z.enum(TIMELINES, { error: 'Choose a timeline' }),
  preferredContact: z.enum(PREFERRED_CONTACT_METHODS, { error: 'Choose a contact method' }),
  consent: consentSchema,
});

export const projectInquirySchema = projectInquiryStep1Schema
  .extend(projectInquiryStep2Schema.shape)
  .extend(projectInquiryStep3Schema.shape)
  .extend(spamFields);
export type ProjectInquiryInput = z.input<typeof projectInquirySchema>;

export const inquiryUpdateSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  assignedToId: idSchema.nullable().optional(),
});
export type InquiryUpdateInput = z.input<typeof inquiryUpdateSchema>;

export const inquiryNoteSchema = z.object({
  body: requiredText(5000, 'Note'),
});
export type InquiryNoteInput = z.input<typeof inquiryNoteSchema>;

export const inquiryQuerySchema = listQuerySchema.extend({
  status: z.enum(LEAD_STATUSES).optional(),
  assignedToId: z.union([idSchema, z.literal('unassigned')]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// ---------- Careers ----------
export const jobApplicationSchema = z.object({
  fullName: requiredText(100, 'Full name'),
  email: emailSchema,
  phone: phoneSchema,
  coverLetter: optionalText(5000),
  portfolioUrl: optionalHttpUrl,
  linkedinUrl: optionalHttpUrl,
  consent: z.preprocess((v) => v === true || v === 'true', consentSchema),
  ...spamFields,
});
export type JobApplicationInput = z.input<typeof jobApplicationSchema>;

export const applicationUpdateSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  internalNotes: optionalText(5000).optional(),
  notifyApplicant: z.boolean().default(false),
});
export type ApplicationUpdateInput = z.input<typeof applicationUpdateSchema>;

export const applicationQuerySchema = listQuerySchema.extend({
  status: z.enum(APPLICATION_STATUSES).optional(),
  jobId: z.union([idSchema, z.literal('general')]).optional(),
});

// ---------- Newsletter ----------
export const newsletterSubscribeSchema = z.object({
  email: emailSchema,
  consent: consentSchema,
  source: z.string().trim().max(50).optional(),
  ...spamFields,
});
export type NewsletterSubscribeInput = z.input<typeof newsletterSubscribeSchema>;

export const newsletterTokenSchema = z.object({
  token: z.string().min(10).max(300),
});

export const subscriberQuerySchema = listQuerySchema.extend({
  status: z.enum(SUBSCRIBER_STATUSES).optional(),
});
