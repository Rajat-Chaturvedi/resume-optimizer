/**
 * Suggests the *shape* of a metric that fits what a bullet actually describes.
 * Placeholders stay blank on purpose: the app proposes the phrasing, the
 * candidate supplies the figures, and nothing is claimed until they do.
 */
export const METRIC_PLACEHOLDER = "__";

type SuggestionRule = { match: RegExp; templates: string[] };

const RULES: SuggestionRule[] = [
  {
    match: /\b(performance|load time|latency|core web vitals|lcp|cls|ttfb|lazy|code splitting|cach)/i,
    templates: [`cutting load time by ${METRIC_PLACEHOLDER}%`, `improving LCP from ${METRIC_PLACEHOLDER}s to ${METRIC_PLACEHOLDER}s`],
  },
  {
    match: /\b(seo|search ranking|organic|meta|sitemap)/i,
    templates: [`lifting organic traffic ${METRIC_PLACEHOLDER}%`, `moving ${METRIC_PLACEHOLDER} pages into the top 10 results`],
  },
  {
    match: /\b(test|jest|cypress|playwright|coverage|qa|regression)/i,
    templates: [`raising test coverage to ${METRIC_PLACEHOLDER}%`, `cutting regression escapes ${METRIC_PLACEHOLDER}%`],
  },
  {
    match: /\b(mentor|coach|junior|team of|onboard|knowledge shar|led a team)/i,
    templates: [`mentoring ${METRIC_PLACEHOLDER} engineers`, `onboarding ${METRIC_PLACEHOLDER} engineers in ${METRIC_PLACEHOLDER} weeks`],
  },
  {
    match: /\b(component librar|reusab|design system|shared package|storybook|internal tool)/i,
    templates: [
      `reused across ${METRIC_PLACEHOLDER} product surfaces`,
      `cutting UI build time ${METRIC_PLACEHOLDER}%`,
    ],
  },
  {
    match: /\b(payment|checkout|stripe|gateway|commerce|order|cart|transaction)/i,
    templates: [
      `lifting checkout conversion ${METRIC_PLACEHOLDER}%`,
      `processing $${METRIC_PLACEHOLDER} in monthly transactions`,
    ],
  },
  {
    match: /\b(ci\/cd|pipeline|deploy|release|build system|jenkins|vercel|heroku)/i,
    templates: [
      `cutting deploy time from ${METRIC_PLACEHOLDER} to ${METRIC_PLACEHOLDER} minutes`,
      `enabling ${METRIC_PLACEHOLDER} releases per week`,
    ],
  },
  {
    match: /\b(accessib|wcag|a11y|aria|screen reader|usability)/i,
    templates: [
      `bringing ${METRIC_PLACEHOLDER} screens to WCAG 2.1 AA`,
      `resolving ${METRIC_PLACEHOLDER} accessibility defects`,
    ],
  },
  {
    match: /\b(migrat|replatform|upgrade|refactor|rewrote|rewrite|monolith)/i,
    templates: [
      `migrating ${METRIC_PLACEHOLDER} screens with zero downtime`,
      `cutting bundle size ${METRIC_PLACEHOLDER}%`,
    ],
  },
  {
    match: /\b(api|graphql|rest|endpoint|integration|apollo|microservice)/i,
    templates: [
      `integrating ${METRIC_PLACEHOLDER} endpoints`,
      `cutting API response time ${METRIC_PLACEHOLDER}%`,
    ],
  },
  {
    match: /\b(mobile|ios|android|responsive|react native|breakpoint|pwa)/i,
    templates: [
      `reaching ${METRIC_PLACEHOLDER} monthly mobile users`,
      `supporting ${METRIC_PLACEHOLDER} device breakpoints`,
    ],
  },
  {
    match: /\b(monitor|observab|sentry|analytics|logging|incident|alert)/i,
    templates: [
      `cutting mean time to detect ${METRIC_PLACEHOLDER}%`,
      `covering ${METRIC_PLACEHOLDER} production services`,
    ],
  },
  {
    match: /\b(agile|scrum|kanban|sprint|cross-functional|stakeholder|collaborat)/i,
    templates: [
      `delivering ${METRIC_PLACEHOLDER} sprints on schedule`,
      `partnering with ${METRIC_PLACEHOLDER} product and design teams`,
    ],
  },
  {
    match: /\b(dashboard|platform|portal|system|enterprise|hrms|oms|inventory)/i,
    templates: [
      `serving ${METRIC_PLACEHOLDER} monthly active users`,
      `supporting ${METRIC_PLACEHOLDER} internal teams`,
    ],
  },
];

const VERB_FALLBACKS: SuggestionRule[] = [
  { match: /^(led|drove|owned|directed|spearheaded)/i, templates: [`leading a team of ${METRIC_PLACEHOLDER}`] },
  { match: /^(built|developed|created|delivered|shipped|launched)/i, templates: [`serving ${METRIC_PLACEHOLDER} monthly users`] },
  { match: /^(improved|optimiz|reduced|accelerated|streamlined)/i, templates: [`by ${METRIC_PLACEHOLDER}%`] },
  { match: /^(automated|migrated|integrated)/i, templates: [`saving ${METRIC_PLACEHOLDER} hours per week`] },
];

/** Up to two metric phrasings that match what the bullet is about. */
export function suggestMetrics(bullet: string): string[] {
  const matched = RULES.filter((rule) => rule.match.test(bullet)).flatMap((rule) => rule.templates);
  const fallback = VERB_FALLBACKS.find((rule) => rule.match.test(bullet.trim()))?.templates ?? [
    `improving delivery by ${METRIC_PLACEHOLDER}%`,
  ];
  const all = matched.length ? matched : fallback;
  return [...new Set(all)].slice(0, 2);
}

export function hasUnfilledPlaceholder(text: string): boolean {
  return text.includes(METRIC_PLACEHOLDER);
}
