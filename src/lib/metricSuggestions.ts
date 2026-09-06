/**
 * Suggests a metric phrasing that fits what a bullet describes, pre-filled with a
 * typical figure. The figures are drafts for the candidate to correct — the UI
 * requires an explicit confirmation before any of them reach the resume.
 */
export const METRIC_PLACEHOLDER = "__";

type Pick = (options: (string | number)[]) => string;
type Template = (pick: Pick) => string;
type Rule = { match: RegExp; templates: Template[] };

const PERCENT = [15, 20, 25, 30, 35, 40];
const SMALL_COUNT = [3, 4, 5, 6, 8];
const MEDIUM_COUNT = [6, 8, 10, 12, 15, 20];
const USERS = ["50k", "120k", "200k", "450k", "1M"];
const MONEY = ["$250k", "$800k", "$1.2M", "$3M"];

const RULES: Rule[] = [
  {
    match: /\b(performance|load time|latency|core web vitals|lcp|cls|ttfb|lazy|code splitting|cach)/i,
    templates: [
      (p) => `cutting load time by ${p(PERCENT)}%`,
      (p) => `improving LCP from ${p([3.1, 2.8, 4.2])}s to ${p([1.1, 1.4, 1.8])}s`,
    ],
  },
  {
    match: /\b(seo|search ranking|organic|meta|sitemap)/i,
    templates: [
      (p) => `lifting organic traffic ${p(PERCENT)}%`,
      (p) => `moving ${p(MEDIUM_COUNT)} pages into the top 10 results`,
    ],
  },
  {
    match: /\b(test|jest|cypress|playwright|coverage|qa|regression)/i,
    templates: [
      (p) => `raising test coverage to ${p([70, 75, 80, 85, 90])}%`,
      (p) => `cutting regression escapes ${p(PERCENT)}%`,
    ],
  },
  {
    match: /\b(mentor|coach|junior|team of|onboard|knowledge shar|led a team)/i,
    templates: [
      (p) => `mentoring ${p(SMALL_COUNT)} engineers`,
      (p) => `onboarding ${p(SMALL_COUNT)} engineers in ${p([2, 3, 4])} weeks`,
    ],
  },
  {
    match: /\b(component librar|reusab|design system|shared package|storybook|internal tool)/i,
    templates: [
      (p) => `reused across ${p(MEDIUM_COUNT)} product surfaces`,
      (p) => `cutting UI build time ${p(PERCENT)}%`,
    ],
  },
  {
    match: /\b(payment|checkout|stripe|gateway|commerce|order|cart|transaction)/i,
    templates: [
      (p) => `lifting checkout conversion ${p([8, 10, 12, 15, 18])}%`,
      (p) => `processing ${p(MONEY)} in monthly transactions`,
    ],
  },
  {
    match: /\b(ci\/cd|pipeline|deploy|release|build system|jenkins|vercel|heroku)/i,
    templates: [
      (p) => `cutting deploy time from ${p([25, 30, 45])} to ${p([5, 8, 10])} minutes`,
      (p) => `enabling ${p([2, 3, 5])} releases per week`,
    ],
  },
  {
    match: /\b(accessib|wcag|a11y|aria|screen reader|usability)/i,
    templates: [
      (p) => `bringing ${p(MEDIUM_COUNT)} screens to WCAG 2.1 AA`,
      (p) => `resolving ${p([18, 24, 30, 45])} accessibility defects`,
    ],
  },
  {
    match: /\b(migrat|replatform|upgrade|refactor|rewrote|rewrite|monolith)/i,
    templates: [
      (p) => `migrating ${p(MEDIUM_COUNT)} screens with zero downtime`,
      (p) => `cutting bundle size ${p(PERCENT)}%`,
    ],
  },
  {
    match: /\b(api|graphql|rest|endpoint|integration|apollo|microservice)/i,
    templates: [
      (p) => `integrating ${p(MEDIUM_COUNT)} endpoints`,
      (p) => `cutting API response time ${p(PERCENT)}%`,
    ],
  },
  {
    match: /\b(mobile|ios|android|responsive|react native|breakpoint|pwa)/i,
    templates: [
      (p) => `reaching ${p(USERS)} monthly mobile users`,
      (p) => `supporting ${p([4, 5, 6])} device breakpoints`,
    ],
  },
  {
    match: /\b(monitor|observab|sentry|analytics|logging|incident|alert)/i,
    templates: [
      (p) => `cutting mean time to detect ${p(PERCENT)}%`,
      (p) => `covering ${p(MEDIUM_COUNT)} production services`,
    ],
  },
  {
    match: /\b(agile|scrum|kanban|sprint|cross-functional|stakeholder|collaborat)/i,
    templates: [
      (p) => `delivering ${p([8, 10, 12, 16])} sprints on schedule`,
      (p) => `partnering with ${p([3, 4, 5])} product and design teams`,
    ],
  },
  {
    match: /\b(dashboard|platform|portal|system|enterprise|hrms|oms|inventory)/i,
    templates: [
      (p) => `serving ${p(USERS)} monthly active users`,
      (p) => `supporting ${p(MEDIUM_COUNT)} internal teams`,
    ],
  },
];

const VERB_FALLBACKS: Rule[] = [
  { match: /^(led|drove|owned|directed|spearheaded)/i, templates: [(p) => `leading a team of ${p(SMALL_COUNT)}`] },
  {
    match: /^(built|developed|created|delivered|shipped|launched)/i,
    templates: [(p) => `serving ${p(USERS)} monthly users`],
  },
  { match: /^(improved|optimis|optimiz|reduced|accelerated|streamlined)/i, templates: [(p) => `by ${p(PERCENT)}%`] },
  { match: /^(automated|migrated|integrated)/i, templates: [(p) => `saving ${p([4, 6, 8, 10])} hours per week`] },
];

/** Same bullet always yields the same figures, so reopening the wizard is stable. */
function seededPicker(seed: string): Pick {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  let step = 0;
  return (options) => {
    step += 1;
    return String(options[(hash + step * 7) % options.length]);
  };
}

/** Up to two metric phrasings that match what the bullet is about. */
export function suggestMetrics(bullet: string): string[] {
  const matched = RULES.filter((rule) => rule.match.test(bullet)).flatMap((rule) => rule.templates);
  const fallback = VERB_FALLBACKS.find((rule) => rule.match.test(bullet.trim()))?.templates ?? [
    (p: Pick) => `improving delivery by ${p(PERCENT)}%`,
  ];
  const templates = (matched.length ? matched : fallback).slice(0, 2);
  const pick = seededPicker(bullet);
  return [...new Set(templates.map((template) => template(pick)))];
}

export function hasUnfilledPlaceholder(text: string): boolean {
  return text.includes(METRIC_PLACEHOLDER);
}
