export const OWL_ASCII_VALUES = [
  "[o-o]",
  "{O,O}",
  "{o,o}",
  "{o,q}",
  "</o,o>",
] as const;

export type OwlAscii = (typeof OWL_ASCII_VALUES)[number];

interface OwlArtOption {
  ascii: OwlAscii;
  name: string;
  description: string;
}

export const OWL_ART_OPTIONS: readonly OwlArtOption[] = [
  {
    ascii: "[o-o]",
    name: "Hooty Potter",
    description: "The owl who lived (to read your feeds).",
  },
  {
    ascii: "{O,O}",
    name: "Owlbert Einstein",
    description: "Reading at the speed of light.",
  },
  {
    ascii: "{o,o}",
    name: "Jane Owl-sten",
    description: '"Pride and Prejudice and RSS."',
  },
  {
    ascii: "{o,q}",
    name: "Sherlock Hoolmes",
    description: "Solving the case of the unread items.",
  },
  {
    ascii: "</o,o>",
    name: "The Devel-owl-per",
    description: "while(awake) { read_feeds(); }",
  },
] as const;

export const DEFAULT_OWL_ASCII: OwlAscii = "{o,o}";

const owlAsciiSet = new Set<string>(OWL_ASCII_VALUES);

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function isOwlAscii(value: string): value is OwlAscii {
  return owlAsciiSet.has(value);
}

export function coerceOwlAscii(value: unknown): OwlAscii {
  if (typeof value === "string" && isOwlAscii(value)) {
    return value;
  }

  return DEFAULT_OWL_ASCII;
}

export function buildOwlFaviconDataUri(owlAscii: OwlAscii): string {
  const svg = [
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'>",
    "<rect width='256' height='256' fill='white'/>",
    "<text x='50%' y='54%' font-size='84' text-anchor='middle' dominant-baseline='middle' font-family='ui-monospace, SFMono-Regular, Menlo, monospace'>",
    escapeXml(owlAscii),
    "</text></svg>",
  ].join("");

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
