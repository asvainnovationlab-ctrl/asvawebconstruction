/** Enum values mirrored from the Prisma schema so the web app does not depend on Prisma. */

export const CONTENT_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL_SENT',
  'WON',
  'LOST',
  'ARCHIVED',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const APPLICATION_STATUSES = [
  'RECEIVED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'SELECTED',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const JOB_STATUSES = ['DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WORKPLACE_TYPES = ['ONSITE', 'HYBRID', 'REMOTE'] as const;
export type WorkplaceType = (typeof WORKPLACE_TYPES)[number];

export const TESTIMONIAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type TestimonialStatus = (typeof TESTIMONIAL_STATUSES)[number];

export const SUBSCRIBER_STATUSES = ['PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED'] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export const TECHNOLOGY_CATEGORIES = [
  'FRONTEND',
  'BACKEND',
  'MOBILE',
  'DATABASE',
  'CLOUD_DEVOPS',
  'DESIGN',
  'TESTING',
  'AI_DATA',
  'OTHER',
] as const;
export type TechnologyCategory = (typeof TECHNOLOGY_CATEGORIES)[number];

export const MEDIA_VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;
export type MediaVisibility = (typeof MEDIA_VISIBILITIES)[number];

export const MEDIA_PURPOSES = ['LIBRARY', 'RESUME', 'INQUIRY_ATTACHMENT'] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const PREFERRED_CONTACT_METHODS = ['EMAIL', 'PHONE', 'WHATSAPP', 'VIDEO_CALL'] as const;
export type PreferredContactMethod = (typeof PREFERRED_CONTACT_METHODS)[number];

export const EMAIL_STATUSES = ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const NAVIGATION_MENU_KEYS = ['HEADER', 'FOOTER_QUICK_LINKS', 'FOOTER_LEGAL'] as const;
export type NavigationMenuKey = (typeof NAVIGATION_MENU_KEYS)[number];

/** Human-readable labels shared by admin and public UI. */
export const LABELS = {
  contentStatus: {
    DRAFT: 'Draft',
    SCHEDULED: 'Scheduled',
    PUBLISHED: 'Published',
    ARCHIVED: 'Archived',
  } satisfies Record<ContentStatus, string>,
  leadStatus: {
    NEW: 'New',
    CONTACTED: 'Contacted',
    QUALIFIED: 'Qualified',
    PROPOSAL_SENT: 'Proposal Sent',
    WON: 'Won',
    LOST: 'Lost',
    ARCHIVED: 'Archived',
  } satisfies Record<LeadStatus, string>,
  applicationStatus: {
    RECEIVED: 'Received',
    UNDER_REVIEW: 'Under Review',
    SHORTLISTED: 'Shortlisted',
    INTERVIEW: 'Interview',
    SELECTED: 'Selected',
    REJECTED: 'Rejected',
    WITHDRAWN: 'Withdrawn',
  } satisfies Record<ApplicationStatus, string>,
  jobStatus: {
    DRAFT: 'Draft',
    OPEN: 'Open',
    CLOSED: 'Closed',
    ARCHIVED: 'Archived',
  } satisfies Record<JobStatus, string>,
  employmentType: {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CONTRACT: 'Contract',
    INTERNSHIP: 'Internship',
    TEMPORARY: 'Temporary',
  } satisfies Record<EmploymentType, string>,
  workplaceType: {
    ONSITE: 'On-site',
    HYBRID: 'Hybrid',
    REMOTE: 'Remote',
  } satisfies Record<WorkplaceType, string>,
  testimonialStatus: {
    PENDING: 'Pending approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  } satisfies Record<TestimonialStatus, string>,
  subscriberStatus: {
    PENDING: 'Pending confirmation',
    SUBSCRIBED: 'Subscribed',
    UNSUBSCRIBED: 'Unsubscribed',
  } satisfies Record<SubscriberStatus, string>,
  technologyCategory: {
    FRONTEND: 'Frontend',
    BACKEND: 'Backend',
    MOBILE: 'Mobile',
    DATABASE: 'Databases',
    CLOUD_DEVOPS: 'Cloud & DevOps',
    DESIGN: 'Design',
    TESTING: 'Testing',
    AI_DATA: 'AI & Data',
    OTHER: 'Other',
  } satisfies Record<TechnologyCategory, string>,
  preferredContact: {
    EMAIL: 'Email',
    PHONE: 'Phone call',
    WHATSAPP: 'WhatsApp',
    VIDEO_CALL: 'Video call',
  } satisfies Record<PreferredContactMethod, string>,
  emailStatus: {
    PENDING: 'Pending',
    SENT: 'Sent',
    FAILED: 'Failed',
    SKIPPED: 'Skipped (not configured)',
  } satisfies Record<EmailStatus, string>,
  navigationMenu: {
    HEADER: 'Header navigation',
    FOOTER_QUICK_LINKS: 'Footer — quick links',
    FOOTER_LEGAL: 'Footer — legal links',
  } satisfies Record<NavigationMenuKey, string>,
} as const;

/** Project inquiry options. Edit these to match the services and pricing the company offers. */
export const PROJECT_TYPES = [
  'Custom software',
  'Web application',
  'Mobile application',
  'Website',
  'E-commerce',
  'UI/UX design',
  'API / integration',
  'Cloud & deployment',
  'AI & automation',
  'IT consulting',
  'Other',
] as const;

export const BUDGET_RANGES = [
  'Below NPR 2 lakh',
  'NPR 2–5 lakh',
  'NPR 5–15 lakh',
  'NPR 15–50 lakh',
  'Above NPR 50 lakh',
  'International project (USD) — let’s discuss',
  'Not sure yet',
] as const;

export const TIMELINES = [
  'As soon as possible',
  '1–3 months',
  '3–6 months',
  '6+ months',
  'Flexible',
] as const;
