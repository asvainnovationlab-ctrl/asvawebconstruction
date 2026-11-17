/** Initial content used by the seed script. Suggested services and FAQs are seeded as drafts. */

export const SUGGESTED_SERVICES = [
  {
    name: 'Custom Software Development',
    slug: 'custom-software-development',
    icon: 'Code2',
    shortDescription: 'Software designed around your processes — from internal tools to complete business platforms.',
    features: ['Requirement analysis and solution design', 'Scalable, maintainable architecture', 'Integration with existing systems', 'Documentation and handover'],
  },
  {
    name: 'Web Application Development',
    slug: 'web-application-development',
    icon: 'AppWindow',
    shortDescription: 'Fast, secure and accessible web applications built with modern frameworks.',
    features: ['Responsive, accessible interfaces', 'Secure authentication and roles', 'Dashboards and admin panels', 'Performance optimisation'],
  },
  {
    name: 'Mobile Application Development',
    slug: 'mobile-application-development',
    icon: 'Smartphone',
    shortDescription: 'Cross-platform and native mobile apps for Android and iOS.',
    features: ['Cross-platform development', 'Offline-first experiences', 'Push notifications', 'App store publishing support'],
  },
  {
    name: 'UI/UX Design',
    slug: 'ui-ux-design',
    icon: 'PenTool',
    shortDescription: 'Research-led interface design that makes products intuitive and enjoyable to use.',
    features: ['User research and journeys', 'Wireframes and prototypes', 'Design systems', 'Usability testing'],
  },
  {
    name: 'E-commerce Development',
    slug: 'e-commerce-development',
    icon: 'ShoppingCart',
    shortDescription: 'Online stores and marketplaces with secure checkout and easy catalogue management.',
    features: ['Product and inventory management', 'Payment gateway integration', 'Order and delivery workflows', 'Analytics and reporting'],
  },
  {
    name: 'Enterprise Software Solutions',
    slug: 'enterprise-software-solutions',
    icon: 'Building2',
    shortDescription: 'Systems that streamline operations across departments — ERP, CRM, HR and more.',
    features: ['Workflow automation', 'Role-based access control', 'Reporting and audit trails', 'Data migration'],
  },
  {
    name: 'API Development & Integration',
    slug: 'api-development-and-integration',
    icon: 'Plug',
    shortDescription: 'Well-documented APIs and reliable integrations between your systems and third-party services.',
    features: ['REST API design and documentation', 'Third-party integrations', 'Payment and SMS gateway integration', 'Webhooks and automation'],
  },
  {
    name: 'Cloud Solutions & Deployment',
    slug: 'cloud-solutions-and-deployment',
    icon: 'Cloud',
    shortDescription: 'Reliable hosting, CI/CD pipelines and infrastructure that scales with demand.',
    features: ['Cloud architecture', 'CI/CD pipelines', 'Containerisation', 'Monitoring and backups'],
  },
  {
    name: 'Software Testing & Quality Assurance',
    slug: 'software-testing-and-quality-assurance',
    icon: 'ShieldCheck',
    shortDescription: 'Manual and automated testing to ship with confidence.',
    features: ['Test planning', 'Automated end-to-end testing', 'Performance and security checks', 'Regression testing'],
  },
  {
    name: 'AI & Automation Solutions',
    slug: 'ai-and-automation-solutions',
    icon: 'Bot',
    shortDescription: 'Practical AI and automation that save time and reduce manual work.',
    features: ['Process automation', 'AI assistants and chatbots', 'Document processing', 'Data insights'],
  },
  {
    name: 'IT Consulting',
    slug: 'it-consulting',
    icon: 'Lightbulb',
    shortDescription: 'Independent technical advice to plan, modernise and de-risk your technology investments.',
    features: ['Technology strategy', 'Architecture reviews', 'Vendor and tool selection', 'Digital transformation planning'],
  },
  {
    name: 'Website Design & Development',
    slug: 'website-design-and-development',
    icon: 'Globe',
    shortDescription: 'Professional, SEO-friendly websites that represent your brand and convert visitors.',
    features: ['Custom design', 'Content management system', 'Search engine optimisation', 'Analytics setup'],
  },
] as const;

export function serviceDescription(name: string, features: readonly string[]): string {
  return `<p>Our ${name.toLowerCase()} service helps organisations turn requirements into dependable, maintainable software. We work closely with your team from discovery through delivery and long-term support.</p>
<h2>What we deliver</h2>
<ul>${features.map((f) => `<li>${f}</li>`).join('')}</ul>
<h2>How we work</h2>
<p>Every engagement follows a transparent process: discovery, planning, design, iterative development with regular demos, testing, deployment and ongoing improvement.</p>`;
}

/** Technologies are seeded hidden: enable only the ones the team genuinely uses. */
export const SUGGESTED_TECHNOLOGIES: { name: string; slug: string; category: string }[] = [
  { name: 'React', slug: 'react', category: 'FRONTEND' },
  { name: 'Next.js', slug: 'nextjs', category: 'FRONTEND' },
  { name: 'TypeScript', slug: 'typescript', category: 'FRONTEND' },
  { name: 'Tailwind CSS', slug: 'tailwind-css', category: 'FRONTEND' },
  { name: 'Vue.js', slug: 'vuejs', category: 'FRONTEND' },
  { name: 'Node.js', slug: 'nodejs', category: 'BACKEND' },
  { name: 'NestJS', slug: 'nestjs', category: 'BACKEND' },
  { name: 'Laravel', slug: 'laravel', category: 'BACKEND' },
  { name: 'Django', slug: 'django', category: 'BACKEND' },
  { name: 'Flutter', slug: 'flutter', category: 'MOBILE' },
  { name: 'React Native', slug: 'react-native', category: 'MOBILE' },
  { name: 'PostgreSQL', slug: 'postgresql', category: 'DATABASE' },
  { name: 'MySQL', slug: 'mysql', category: 'DATABASE' },
  { name: 'MongoDB', slug: 'mongodb', category: 'DATABASE' },
  { name: 'Redis', slug: 'redis', category: 'DATABASE' },
  { name: 'Docker', slug: 'docker', category: 'CLOUD_DEVOPS' },
  { name: 'AWS', slug: 'aws', category: 'CLOUD_DEVOPS' },
  { name: 'GitHub Actions', slug: 'github-actions', category: 'CLOUD_DEVOPS' },
  { name: 'Figma', slug: 'figma', category: 'DESIGN' },
  { name: 'Playwright', slug: 'playwright', category: 'TESTING' },
  { name: 'Jest / Vitest', slug: 'jest-vitest', category: 'TESTING' },
  { name: 'Python', slug: 'python', category: 'AI_DATA' },
  { name: 'OpenAI / LLM APIs', slug: 'llm-apis', category: 'AI_DATA' },
];

export const SUGGESTED_FAQS: { category: string; question: string; answer: string }[] = [
  { category: 'Working with us', question: 'How does a project with Asva Innovation Lab start?', answer: '<p>We begin with a discovery conversation to understand your goals, users and constraints. We then share a proposal with scope, timeline and cost before any development starts.</p>' },
  { category: 'Working with us', question: 'Do you work with clients outside Nepal?', answer: '<p>Yes. We work remotely with international clients and agree on communication schedules that suit both time zones.</p>' },
  { category: 'Working with us', question: 'How will I know how my project is progressing?', answer: '<p>You will have regular progress updates and demos, and access to the working software throughout development.</p>' },
  { category: 'Pricing & timelines', question: 'How much does a software project cost?', answer: '<p>Cost depends on scope, complexity and timeline. Share your requirements through the Start a Project form and we will prepare an estimate.</p>' },
  { category: 'Pricing & timelines', question: 'How long does it take to build an application?', answer: '<p>Timelines vary with scope. A focused website may take a few weeks, while a larger platform may take several months. We plan in milestones so value is delivered early.</p>' },
  { category: 'Support', question: 'Do you provide support after launch?', answer: '<p>Yes. We offer maintenance and support arrangements covering updates, monitoring, fixes and improvements.</p>' },
  { category: 'Support', question: 'Who owns the source code?', answer: '<p>Ownership terms are agreed in the project contract. Typically, clients own the code developed specifically for them once the project is paid for.</p>' },
];

const REVIEW_NOTICE = `<blockquote><p><strong>Template — legal review required.</strong> This page was generated as a starting point and is not legal advice. Have it reviewed by a qualified lawyer familiar with the laws of Nepal (including the Individual Privacy Act, 2075) and of any market you serve, then remove this notice.</p></blockquote>`;

export const LEGAL_PAGES = [
  {
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    seoDescription: 'How Asva Innovation Lab collects, uses and protects personal information.',
    content: `${REVIEW_NOTICE}
<p><em>Last updated: [DATE — to be completed]</em></p>
<h2>Who we are</h2>
<p>Asva Innovation Lab Pvt. Ltd. (“we”, “us”) is a software development company based in Pokhara, Nepal. Contact: [CONTACT EMAIL — to be completed].</p>
<h2>Information we collect</h2>
<ul><li><strong>Contact and project inquiries:</strong> name, email, phone, company, project details and any files you attach.</li><li><strong>Job applications:</strong> name, contact details, CV/resume, portfolio links and cover letter.</li><li><strong>Newsletter:</strong> email address and a record of your consent.</li><li><strong>Technical data:</strong> a hashed (non-reversible) fingerprint of your IP address for abuse prevention, and — only with your consent — analytics data.</li></ul>
<h2>How we use information</h2>
<p>To respond to your inquiry, evaluate job applications, send newsletters you asked for, protect the website from abuse and, with consent, understand how the site is used.</p>
<h2>Legal basis</h2>
<p>[To be completed after legal review — e.g. consent, steps prior to a contract, legitimate interests.]</p>
<h2>Retention</h2>
<p>Archived contact messages are deleted after about two years, closed leads after about three years, and unsuccessful job applications after about one year, unless a longer period is required by law. [Confirm periods.]</p>
<h2>Sharing</h2>
<p>We do not sell personal information. We use service providers (hosting, email delivery, file storage, analytics) who process data on our behalf. [List providers and locations.]</p>
<h2>Your rights</h2>
<p>You may request access to, correction of or deletion of your personal information, and withdraw consent at any time. Contact us at [CONTACT EMAIL].</p>
<h2>Security</h2>
<p>We use encryption in transit, access controls, audit logging and secure storage to protect information.</p>
<h2>Changes</h2>
<p>We may update this policy and will revise the date above when we do.</p>`,
  },
  {
    title: 'Terms and Conditions',
    slug: 'terms-and-conditions',
    seoDescription: 'Terms governing the use of the Asva Innovation Lab website.',
    content: `${REVIEW_NOTICE}
<p><em>Last updated: [DATE — to be completed]</em></p>
<h2>Use of this website</h2>
<p>By using this website you agree to these terms. If you do not agree, please do not use the site.</p>
<h2>Information on the site</h2>
<p>Content is provided for general information and may change without notice. It does not form an offer or contract; project engagements are governed by separate written agreements.</p>
<h2>Intellectual property</h2>
<p>Unless stated otherwise, content, design and branding on this site belong to Asva Innovation Lab Pvt. Ltd.</p>
<h2>Submissions</h2>
<p>You agree that information you submit through forms is accurate and that you have the right to share any files you upload.</p>
<h2>Limitation of liability</h2>
<p>[To be completed after legal review.]</p>
<h2>Governing law</h2>
<p>These terms are governed by the laws of Nepal. [Confirm jurisdiction.]</p>`,
  },
  {
    title: 'Cookie Policy',
    slug: 'cookie-policy',
    seoDescription: 'How the Asva Innovation Lab website uses cookies.',
    content: `${REVIEW_NOTICE}
<h2>What are cookies?</h2>
<p>Cookies are small text files stored by your browser.</p>
<h2>Essential cookies</h2>
<p>We use essential cookies to remember your cookie preferences and, for staff, to keep the administration area signed in securely. These cannot be switched off.</p>
<h2>Analytics cookies (optional)</h2>
<p>If analytics are enabled, we use Google Analytics only after you accept analytics cookies. You can change your choice at any time using the “Cookie settings” link in the footer.</p>
<h2>Managing cookies</h2>
<p>You can also delete or block cookies in your browser settings.</p>`,
  },
];

export const DEFAULT_NAVIGATION = {
  HEADER: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Services', href: '/services' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: '/contact' },
  ],
  FOOTER_QUICK_LINKS: [
    { label: 'About us', href: '/about' },
    { label: 'Technologies', href: '/technologies' },
    { label: 'Careers', href: '/careers' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Start a project', href: '/start-a-project' },
  ],
  FOOTER_LEGAL: [
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Terms and Conditions', href: '/terms-and-conditions' },
    { label: 'Cookie Policy', href: '/cookie-policy' },
  ],
} as const;
