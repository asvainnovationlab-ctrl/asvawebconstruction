import { Inject, Injectable, Logger } from '@nestjs/common';
import { LABELS, type ApplicationStatus } from '@asva/shared';
import { ENV, type Env } from '../config/env.js';
import { SettingsService } from '../settings/settings.service.js';
import { EmailService } from './email.service.js';
import { renderEmail } from './templates.js';

/**
 * Composes and enqueues every transactional email. Failures here never fail the originating
 * request — submissions are already persisted — but they are logged.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly email: EmailService,
    private readonly settings: SettingsService,
  ) {}

  private async context() {
    const [general, notifications] = await Promise.all([this.settings.getGroup('general'), this.settings.getGroup('notifications')]);
    return { company: general.companyName, site: this.env.FRONTEND_URL.replace(/\/$/, ''), notifications };
  }

  private async safely(label: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (error) {
      this.logger.error({ err: error, label }, 'Failed to enqueue notification email');
    }
  }

  contactReceived(s: { id: string; name: string; email: string; phone: string | null; company: string | null; subject: string | null; message: string }) {
    return this.safely('contact', async () => {
      const { company, site, notifications } = await this.context();
      await this.email.enqueue(
        notifications.contactRecipients,
        renderEmail(`New contact message from ${s.name}`, {
          companyName: company,
          siteUrl: site,
          preheader: s.subject ?? s.message.slice(0, 80),
          heading: 'New contact form submission',
          paragraphs: ['A visitor sent a message through the website contact form.'],
          rows: [['Name', s.name], ['Email', s.email], ['Phone', s.phone], ['Company', s.company], ['Subject', s.subject], ['Message', s.message]],
          button: { label: 'Open in admin', href: `${site}/admin/contact/${s.id}` },
          footerNote: 'Internal notification. Contains personal data — do not forward outside the team.',
        }),
        'contact.notification',
      );
      if (notifications.sendSubmitterConfirmations) {
        await this.email.enqueue(
          s.email,
          renderEmail(`We received your message — ${company}`, {
            companyName: company,
            siteUrl: site,
            preheader: 'Thanks for getting in touch.',
            heading: `Thank you, ${s.name}`,
            paragraphs: ['We have received your message and a member of our team will reply as soon as possible, usually within two business days.', 'For reference, here is what you sent:'],
            rows: [['Subject', s.subject], ['Message', s.message]],
            footerNote: 'You are receiving this because you submitted the contact form on our website.',
          }),
          'contact.confirmation',
        );
      }
    });
  }

  inquiryReceived(i: { id: string; fullName: string; email: string; phone: string; companyName: string | null; projectType: string; description: string; budgetRange: string; timeline: string; preferredContact: string; hasAttachment: boolean }) {
    return this.safely('inquiry', async () => {
      const { company, site, notifications } = await this.context();
      await this.email.enqueue(
        notifications.leadRecipients,
        renderEmail(`New project inquiry: ${i.projectType} — ${i.fullName}`, {
          companyName: company,
          siteUrl: site,
          preheader: `${i.budgetRange} · ${i.timeline}`,
          heading: 'New project inquiry',
          paragraphs: ['A new lead was submitted through the Start a Project form.'],
          rows: [
            ['Name', i.fullName], ['Email', i.email], ['Phone', i.phone], ['Company', i.companyName], ['Project type', i.projectType],
            ['Budget', i.budgetRange], ['Timeline', i.timeline], ['Preferred contact', LABELS.preferredContact[i.preferredContact as keyof typeof LABELS.preferredContact]],
            ['Attachment', i.hasAttachment ? 'Yes — download from the admin panel' : 'No'], ['Description', i.description],
          ],
          button: { label: 'Open lead', href: `${site}/admin/inquiries/${i.id}` },
          footerNote: 'Internal notification. Contains personal data — do not forward outside the team.',
        }),
        'inquiry.notification',
      );
      if (notifications.sendSubmitterConfirmations) {
        await this.email.enqueue(
          i.email,
          renderEmail(`Your project inquiry — ${company}`, {
            companyName: company,
            siteUrl: site,
            preheader: 'We have received your project details.',
            heading: `Thanks for reaching out, ${i.fullName}`,
            paragraphs: ['We have received your project inquiry. Our team will review the details and contact you using your preferred method, usually within two business days.'],
            rows: [['Project type', i.projectType], ['Budget', i.budgetRange], ['Timeline', i.timeline]],
            footerNote: 'You are receiving this because you submitted a project inquiry on our website.',
          }),
          'inquiry.confirmation',
        );
      }
    });
  }

  applicationReceived(a: { id: string; fullName: string; email: string; phone: string; jobTitle: string | null }) {
    return this.safely('application', async () => {
      const { company, site, notifications } = await this.context();
      const role = a.jobTitle ?? 'General application';
      await this.email.enqueue(
        notifications.careersRecipients,
        renderEmail(`New application: ${role} — ${a.fullName}`, {
          companyName: company,
          siteUrl: site,
          preheader: role,
          heading: 'New job application',
          paragraphs: ['A candidate applied through the careers page. The resume is available in the admin panel to authorised staff.'],
          rows: [['Position', role], ['Name', a.fullName], ['Email', a.email], ['Phone', a.phone]],
          button: { label: 'Review application', href: `${site}/admin/applications/${a.id}` },
          footerNote: 'Internal notification. Contains candidate personal data — handle confidentially.',
        }),
        'application.notification',
      );
      if (notifications.sendSubmitterConfirmations) {
        await this.email.enqueue(
          a.email,
          renderEmail(`Application received — ${company}`, {
            companyName: company,
            siteUrl: site,
            preheader: `Thank you for applying: ${role}`,
            heading: `Thank you for applying, ${a.fullName}`,
            paragraphs: [`We have received your application for: ${role}.`, 'Our team reviews every application carefully. We will contact you if your profile matches the role.'],
            footerNote: 'You are receiving this because you submitted a job application on our website.',
          }),
          'application.confirmation',
        );
      }
    });
  }

  applicationStatusChanged(a: { fullName: string; email: string; jobTitle: string | null; status: ApplicationStatus }) {
    return this.safely('application-status', async () => {
      const { company, site } = await this.context();
      const role = a.jobTitle ?? 'your application';
      const messages: Partial<Record<ApplicationStatus, string>> = {
        UNDER_REVIEW: 'Your application is now being reviewed by our team.',
        SHORTLISTED: 'Good news — you have been shortlisted. We will contact you shortly about next steps.',
        INTERVIEW: 'We would like to invite you to an interview. A member of our team will contact you to arrange a time.',
        SELECTED: 'Congratulations — we would like to move forward with you. We will be in touch with the details.',
        REJECTED: 'Thank you for your interest. After careful consideration we will not be moving forward with your application at this time. We wish you every success.',
      };
      const message = messages[a.status];
      if (!message) return;
      await this.email.enqueue(
        a.email,
        renderEmail(`Update on ${a.jobTitle ? `your application for ${a.jobTitle}` : 'your application'} — ${company}`, {
          companyName: company,
          siteUrl: site,
          preheader: LABELS.applicationStatus[a.status],
          heading: `Hello ${a.fullName}`,
          paragraphs: [`An update regarding ${role}:`, message],
          footerNote: 'You are receiving this because you applied for a position with us.',
        }),
        'application.status',
      );
    });
  }

  async passwordReset(user: { email: string; name: string }, link: string) {
    const { company, site } = await this.context();
    await this.email.enqueue(
      user.email,
      renderEmail(`Reset your ${company} admin password`, {
        companyName: company,
        siteUrl: site,
        preheader: 'This link expires in 30 minutes.',
        heading: 'Password reset requested',
        paragraphs: [`Hello ${user.name}, someone requested a password reset for your admin account.`, 'The link below expires in 30 minutes and can be used once. If you did not request this, you can ignore this email.'],
        button: { label: 'Choose a new password', href: link },
        footerNote: 'Security notice: we will never ask for your password by email.',
      }),
      'auth.password-reset',
    );
  }

  async invitation(user: { email: string; name: string }, link: string, invitedBy: string) {
    const { company, site } = await this.context();
    await this.email.enqueue(
      user.email,
      renderEmail(`You have been invited to the ${company} admin`, {
        companyName: company,
        siteUrl: site,
        preheader: `${invitedBy} invited you.`,
        heading: `Welcome, ${user.name}`,
        paragraphs: [`${invitedBy} has invited you to the website administration panel.`, 'Use the link below to set your password. It expires in 72 hours.'],
        button: { label: 'Set your password', href: link },
      }),
      'auth.invitation',
    );
  }

  async newsletterConfirm(email: string, link: string) {
    const { company, site } = await this.context();
    await this.email.enqueue(
      email,
      renderEmail(`Confirm your subscription — ${company}`, {
        companyName: company,
        siteUrl: site,
        preheader: 'One click to confirm.',
        heading: 'Please confirm your subscription',
        paragraphs: ['Thanks for subscribing to our newsletter. Please confirm your email address to start receiving updates.', 'If you did not subscribe, ignore this email and you will not be added.'],
        button: { label: 'Confirm subscription', href: link },
        footerNote: 'You are receiving this because this address was entered in our newsletter form.',
      }),
      'newsletter.confirm',
    );
  }
}
