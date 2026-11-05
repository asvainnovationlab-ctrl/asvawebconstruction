import type { ApplicationStatus, LeadStatus } from './enums.js';

/**
 * Allowed lead status transitions. ARCHIVED can be restored to NEW; WON/LOST are closed but
 * LOST can be reopened. Keeping this in one place lets the API enforce it and the admin UI
 * offer only valid options.
 */
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['CONTACTED', 'QUALIFIED', 'LOST', 'ARCHIVED'],
  CONTACTED: ['QUALIFIED', 'PROPOSAL_SENT', 'LOST', 'ARCHIVED'],
  QUALIFIED: ['CONTACTED', 'PROPOSAL_SENT', 'LOST', 'ARCHIVED'],
  PROPOSAL_SENT: ['QUALIFIED', 'WON', 'LOST', 'ARCHIVED'],
  WON: ['ARCHIVED'],
  LOST: ['QUALIFIED', 'ARCHIVED'],
  ARCHIVED: ['NEW'],
};

export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  return from === to || LEAD_TRANSITIONS[from].includes(to);
}

export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  RECEIVED: ['UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW: ['SELECTED', 'REJECTED', 'WITHDRAWN'],
  SELECTED: ['WITHDRAWN'],
  REJECTED: ['UNDER_REVIEW'],
  WITHDRAWN: [],
};

export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return from === to || APPLICATION_TRANSITIONS[from].includes(to);
}

/** Statuses for which an applicant may be notified by email. */
export const APPLICANT_NOTIFIABLE_STATUSES: ApplicationStatus[] = [
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'SELECTED',
  'REJECTED',
];

export interface PublishableLike {
  status: string;
  publishedAt: Date | string | null;
}

/** Public visibility rule used everywhere: published and the publication date has passed. */
export function isPubliclyVisible(item: PublishableLike, now: Date = new Date()): boolean {
  if (item.status !== 'PUBLISHED' || !item.publishedAt) return false;
  return new Date(item.publishedAt).getTime() <= now.getTime();
}

/**
 * Resolves the stored status/publishedAt for a save request.
 * - PUBLISHED without a date publishes now; a future date becomes SCHEDULED.
 * - SCHEDULED requires a future date.
 */
export function resolvePublication(
  requested: { status: string; publishedAt?: string | Date | null },
  existingPublishedAt: Date | null,
  now: Date = new Date(),
): { status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'; publishedAt: Date | null } {
  const date = requested.publishedAt ? new Date(requested.publishedAt) : null;
  switch (requested.status) {
    case 'PUBLISHED': {
      const at = date ?? existingPublishedAt ?? now;
      return at.getTime() > now.getTime() ? { status: 'SCHEDULED', publishedAt: at } : { status: 'PUBLISHED', publishedAt: at };
    }
    case 'SCHEDULED': {
      if (!date || date.getTime() <= now.getTime()) {
        throw new Error('A scheduled item needs a publication date in the future.');
      }
      return { status: 'SCHEDULED', publishedAt: date };
    }
    case 'ARCHIVED':
      return { status: 'ARCHIVED', publishedAt: existingPublishedAt };
    default:
      return { status: 'DRAFT', publishedAt: date };
  }
}
