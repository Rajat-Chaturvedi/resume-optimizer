const STOPWORDS = new Set(
  `a an the and or but if while of to in on for with without within by from as at into over under across per via is are was were be been being have has had do does did will would shall should can could may might must you your our we they their his her its it this that these those there here what which who whom when where why how all any both each few more most other some such no nor not only own same so than too very just also about above after again against because before below between during further once out off up down out again more team teams work working works role roles job jobs position candidate candidates ideal preferred required requirement requirements responsibilities responsibility qualifications experience experiences years year strong excellent good great ability able help helps helping join joining company companies looking seeking including include includes etc plus us new using use used across ensure ensuring drive driving build building deliver delivering support supporting`.split(
    /\s+/
  )
);

// Employer-branding language that inflates keyword counts without describing a requirement.
const BOILERPLATE = new Set(
  `mission vision culture cultural values value benefit benefits perk perks salary salaries compensation equity stock option options insurance medical dental holiday holidays office remote hybrid onsite talent talents people person humanity world worlds decade future purpose passion passionate authentic curious relentlessly creativity creative dream dreams magic magicians wizardry superhero superheroes innovation innovations innovative journey story impact outsized exceptional amazing awesome exciting thrive thriving grow growth empowerment transparency meritocracy inclusive diversity diverse equal opportunity employer belonging wellbeing coffee food games fun celebrate celebrating victory hire hiring recruiter recruiting apply application applicant career careers organization organizations organisation organisations startup founder founders ceo cto investor investors seed round revenue billion billions million millions bank banks client clients customer customers partner partners overview description summary hear founders life speed thought scale reality idea ideas force behind stack stay staying staying updated latest industry trends best practices practice
   designing developing maintaining collaborating driving conducting championing acting translating translate translated utilising utilizing shipping identifying resolving contributing understanding understand adhere knowledge familiarity proficiency expertise expertize attention detail principle principles manager managers designer designers stakeholder deadline deadlines timeline timelines standard standards convention conventions solution solutions improvement improvements requirement plan plans design designs task tasks feedback decision decisions expert track record skill skills like leading ensuring working managing creating providing making performing handling`.split(
    /\s+/
  )
);

// Multi-word terms are matched before unigrams so "machine learning" is not split.
const KNOWN_PHRASES = [
  "machine learning",
  "deep learning",
  "natural language processing",
  "large language models",
  "computer vision",
  "data structures",
  "distributed systems",
  "system design",
  "unit testing",
  "integration testing",
  "test driven development",
  "continuous integration",
  "continuous delivery",
  "continuous deployment",
  "object oriented",
  "microservices architecture",
  "event driven",
  "rest api",
  "restful apis",
  "web services",
  "cloud computing",
  "infrastructure as code",
  "site reliability",
  "version control",
  "agile methodologies",
  "product management",
  "project management",
  "stakeholder management",
  "cross functional",
  "a/b testing",
  "data pipelines",
  "data modeling",
  "data warehouse",
  "business intelligence",
  "quality assurance",
  "code review",
  "design patterns",
  "front end",
  "back end",
  "full stack",
  "user experience",
  "design systems",
  "performance optimization",
  "root cause analysis",
  "incident management",
  "release management",
  "customer facing",
  "technical leadership",
  "people management",
  "mentoring engineers",
  "budget management",
  "go to market",
  "responsive design",
  "cross browser",
  "state management",
  "component library",
  "component libraries",
  "accessibility standards",
  "web performance",
  "server side rendering",
  "single page application",
  "micro frontends",
  "web technologies",
  "agile development",
];

const TOOL_TERMS = new Set(
  `javascript typescript python java kotlin swift golang go rust ruby php scala perl c c++ c# .net node nodejs deno bun react reactjs nextjs next.js angular angularjs vue vuejs svelte solidjs remix astro gatsby redux mobx zustand recoil rxjs graphql apollo express nestjs django flask fastapi spring springboot rails laravel dotnet aws azure gcp kubernetes k8s docker terraform ansible pulumi jenkins circleci github gitlab bitbucket git jira confluence figma storybook postgres postgresql mysql mongodb dynamodb redis elasticsearch kafka pubsub rabbitmq spark hadoop airflow snowflake databricks bigquery redshift tableau powerbi looker sql nosql grafana prometheus datadog splunk sentry jest cypress playwright selenium vitest junit pytest webpack vite rollup esbuild turbopack babel eslint prettier sass scss less tailwind bootstrap material-ui mui chakra html html5 css css3 rest grpc websocket oauth saml jwt linux unix bash serverless lambda ec2 s3 rds sqs sns cloudformation cdk helm istio openai langchain pytorch tensorflow keras pandas numpy scikit sklearn huggingface frontend backend fullstack ui ux seo wcag a11y ssr ssg pwa spa`.split(
    /\s+/
  )
);

const QUALIFICATION_TERMS = new Set(
  `bachelor bachelors master masters phd degree certification certified aws-certified pmp cissp cpa mba scrum safe security clearance license accredited diploma`.split(
    /\s+/
  )
);

const SOFT_TERMS = new Set(
  `communication collaboration leadership ownership mentorship mentoring influence negotiation empathy adaptability initiative autonomy presentation storytelling facilitation prioritization`.split(
    /\s+/
  )
);

// Hyphen/slash spellings that must collapse onto one canonical keyword.
const CANONICAL_TOKENS: Record<string, string> = {
  "front-end": "frontend",
  "back-end": "backend",
  "full-stack": "fullstack",
  "cross-browser": "cross browser",
  "cross-functional": "cross functional",
  "ui/ux": "ui",
  "ux/ui": "ux",
  "ci/cd": "continuous integration",
  "react.js": "react",
  reactjs: "react",
  "vue.js": "vue",
  vuejs: "vue",
  "next.js": "nextjs",
  "node.js": "nodejs",
  js: "javascript",
  ts: "typescript",
};

export const ACTION_VERBS = [
  "Led",
  "Drove",
  "Built",
  "Designed",
  "Architected",
  "Launched",
  "Delivered",
  "Scaled",
  "Reduced",
  "Increased",
  "Improved",
  "Automated",
  "Migrated",
  "Optimized",
  "Owned",
  "Partnered",
  "Shipped",
  "Spearheaded",
  "Streamlined",
  "Mentored",
  "Established",
  "Accelerated",
  "Eliminated",
  "Negotiated",
  "Consolidated",
];

const WEAK_OPENERS = [
  "responsible for",
  "worked on",
  "helped",
  "assisted",
  "involved in",
  "participated in",
  "tasked with",
  "duties included",
  "in charge of",
  "part of a team",
];

export type Keyword = {
  term: string;
  frequency: number;
  category: "hard-skill" | "tool" | "qualification" | "soft-skill" | "domain";
};

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    // British "optimisation"/"prioritise" must match American resume spellings.
    .replace(/\b(\w{4,}?)is(ation|ations|ing|ed|es|e)\b/g, "$1iz$2")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  // "ambitious", "analysis", "css" must not lose their final letter.
  if (word.length > 3 && word.endsWith("s") && !/(us|ss|is|as)$/.test(word)) return word.slice(0, -1);
  return word;
}

function categorise(term: string): Keyword["category"] {
  const head = term.split(" ")[0];
  if (TOOL_TERMS.has(term) || TOOL_TERMS.has(head)) return "tool";
  if (QUALIFICATION_TERMS.has(term) || QUALIFICATION_TERMS.has(head)) return "qualification";
  if (SOFT_TERMS.has(term) || SOFT_TERMS.has(head)) return "soft-skill";
  if (term.includes(" ")) return "hard-skill";
  return "domain";
}

const REQUIREMENT_HEADING =
  /^\s*(what you'?ll do|what you will do|key responsibilities|responsibilities|requirements?|qualifications?|who you are|what we'?re looking for|must[- ]haves?|nice[- ]to[- ]haves?|skills?( and experience)?|your (impact|role)|the role|basic qualifications|preferred qualifications|technical skills)\b.{0,40}:?\s*$/i;

const NON_REQUIREMENT_HEADING =
  /^\s*(about (us|the company|zamp|the job|our|the team)|our (culture|values|benefits|mission)|culture( and benefits)?|benefits?|perks?|why (join|work)|compensation|equal (employment )?opportunity|diversity|how to apply|mission)\b.{0,40}:?\s*$/i;

/**
 * Job posts mix requirements with employer branding. Keyword scoring only makes
 * sense against the requirement blocks, so isolate them when they are present.
 */
export function focusRequirements(jd: string): string {
  const lines = jd.split(/\r?\n/);
  const kept: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (REQUIREMENT_HEADING.test(line)) {
      capturing = true;
      continue;
    }
    if (NON_REQUIREMENT_HEADING.test(line)) {
      capturing = false;
      continue;
    }
    if (capturing) kept.push(line);
  }

  const focused = kept.join("\n").trim();
  return focused.length > 250 ? focused : jd;
}

export function extractKeywords(text: string, limit = 60): Keyword[] {
  const clean = normalise(text);
  const counts = new Map<string, number>();

  for (const phrase of KNOWN_PHRASES) {
    const matches = clean.split(phrase).length - 1;
    if (matches > 0) counts.set(phrase, (counts.get(phrase) ?? 0) + matches);
  }

  const withoutPhrases = KNOWN_PHRASES.reduce((acc, p) => acc.split(p).join(" "), clean);
  for (const raw of withoutPhrases.split(/[\s,;:()[\]]+/)) {
    const token = raw.replace(/^[-.]+|[-.]+$/g, "");
    if (token.length < 2 || token.length > 28) continue;
    if (STOPWORDS.has(token) || BOILERPLATE.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    const canonical = CANONICAL_TOKENS[token] ?? token;
    const key = TOOL_TERMS.has(canonical) ? canonical : singular(canonical);
    if (STOPWORDS.has(key) || BOILERPLATE.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([term, frequency]) => ({ term, frequency, category: categorise(term) }))
    .filter((k) => k.category !== "domain" || k.frequency > 1 || k.term.length > 5)
    .sort((a, b) => {
      // Concrete skills outrank generic domain nouns even when the nouns repeat more.
      const weight = (k: Keyword) =>
        (1 + Math.log2(k.frequency)) *
        (k.category === "tool" ? 6 : k.category === "hard-skill" ? 4.5 : k.category === "qualification" ? 3 : k.category === "soft-skill" ? 1.6 : 1);
      return weight(b) - weight(a);
    })
    .slice(0, limit);
}

const ALIASES: Record<string, string[]> = {
  javascript: ["js", "es6", "ecmascript"],
  typescript: ["ts"],
  kubernetes: ["k8s"],
  postgresql: ["postgres"],
  "continuous integration": ["ci", "ci/cd"],
  "continuous delivery": ["cd", "ci/cd"],
  nodejs: ["node", "node.js"],
  nextjs: ["next.js", "next js"],
  react: ["react.js", "reactjs"],
  vue: ["vue.js", "vuejs"],
  angular: ["angularjs", "angular.js"],
  frontend: ["front-end", "front end", "fe"],
  backend: ["back-end", "back end"],
  fullstack: ["full-stack", "full stack"],
  html: ["html5"],
  css: ["css3"],
  sass: ["scss"],
  ui: ["ui/ux", "ux/ui", "user interface"],
  ux: ["ui/ux", "ux/ui", "user experience"],
  accessibility: ["a11y", "wcag"],
  "responsive design": ["mobile-first", "mobile first", "responsive"],
  "machine learning": ["ml"],
  "natural language processing": ["nlp"],
  "large language models": ["llm", "llms"],
  "amazon web services": ["aws"],
  "google cloud platform": ["gcp"],
  "infrastructure as code": ["iac", "terraform"],
  "test driven development": ["tdd"],
  "user experience": ["ux"],
  "component library": ["design system", "component libraries", "storybook"],
  "version control": ["git", "github", "gitlab"],
  "agile methodologies": ["agile", "scrum", "kanban"],
  "agile development": ["agile", "scrum", "kanban"],
  "design patterns": ["design pattern"],
};

export function findInText(term: string, haystack: string): string | undefined {
  const base = [term, singular(term), `${singular(term)}s`, ...(ALIASES[term] ?? [])];
  // "cross functional" must also match "cross-functional", "code review" match "code reviews".
  const variants = new Set(
    base.flatMap((v) => [v, v.replace(/-/g, " "), v.replace(/\s+/g, "-"), v.replace(/[\s-]/g, "")])
  );

  for (const variant of variants) {
    if (variant.length < 2) continue;
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = haystack.match(new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i"));
    if (match) return variant;
  }
  return undefined;
}

export function detectWeakOpeners(bullet: string): string | undefined {
  const lower = bullet.toLowerCase().trim();
  return WEAK_OPENERS.find((w) => lower.startsWith(w) || lower.startsWith(`• ${w}`));
}

export function hasMetric(bullet: string): boolean {
  if (/(\$\s?\d)|(\d+(\.\d+)?\s*%)/.test(bullet)) return true;
  if (
    /\d+(\.\d+)?\s*(x\b|k\b|m\b|bn\b|million|billion|hours?|days?|weeks?|months?|users?|customers?|requests?|ms\b|seconds?|qps|rps|tps)/i.test(
      bullet
    )
  ) {
    return true;
  }
  // Counted work items read as metrics too: "6 engineers", "6 product surfaces".
  if (
    /\d+\s+(\w+\s+){0,2}(engineers?|developers?|teams?|services?|screens?|endpoints?|sprints?|surfaces?|breakpoints?|releases?|defects?|pages?|apps?|applications?|features?|components?|integrations?|clients?|stores?|markets?|countries|gateways?|libraries|modules?)/i.test(
      bullet
    )
  ) {
    return true;
  }
  // "led a team of 8"
  if (/\b(team|group|squad|crew|cohort)\s+of\s+\d+/i.test(bullet)) return true;
  return /\d{2,}/.test(bullet);
}

export function startsWithActionVerb(bullet: string): boolean {
  const first = bullet.trim().replace(/^[•\-*\s]+/, "").split(/\s+/)[0] ?? "";
  if (!first) return false;
  if (ACTION_VERBS.some((v) => v.toLowerCase() === first.toLowerCase())) return true;
  // Past-tense verbs ("Refactored", "Consolidated") also satisfy the FAANG bullet convention.
  return /^[A-Za-z]+ed$/.test(first) && !/^(need|want|assist|help)ed$/i.test(first);
}
