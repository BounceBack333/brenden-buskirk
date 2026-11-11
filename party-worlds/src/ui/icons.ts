/** Inline SVG icons (original, simple, consistent stroke). */
const S = (body: string, extra = ''): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICON = {
  play: S('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  people: S('<circle cx="8.5" cy="8" r="3.2"/><path d="M2.5 19c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.6 0 4.6 1.3 5.3 4.3"/>'),
  globe: S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
  gear: S('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>'),
  pause: S('<path d="M8 5v14M16 5v14"/>'),
  expand: S('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  back: S('<path d="M14 5l-7 7 7 7"/>'),
  retry: S('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>'),
  home: S('<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>'),
  couch: S('<rect x="3" y="10" width="18" height="7" rx="2.5"/><path d="M6 10V8a2.5 2.5 0 0 1 2.5-2.5h7A2.5 2.5 0 0 1 18 8v2M6 17v2M18 17v2"/>'),
  robot: S('<rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/><circle cx="12" cy="3.5" r="1"/>'),
  wifi: S('<path d="M3 9c5-4.5 13-4.5 18 0M6.5 12.5c3.2-3 7.8-3 11 0M10 16c1.2-1 2.8-1 4 0"/><circle cx="12" cy="19" r="0.8" fill="currentColor"/>'),
  hand: S('<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5v-1a1.5 1.5 0 0 1 3 0V11M14 10.8a1.5 1.5 0 0 1 3 0V15c0 3.5-2 6-5.5 6S6 19 5 16.5l-1.2-3a1.4 1.4 0 0 1 2.5-1.2L8 14"/>', 'class="ghost"'),
  wind: S('<path d="M3 9h10a3 3 0 1 0-3-3M3 14h14a3 3 0 1 1-3 3M3 19h6"/>'),
  arrow: S('<path d="M4 12h15M13 6l6 6-6 6"/>'),
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l2.9 6.2 6.7.8-5 4.6 1.4 6.7L12 17.1 5.9 20.5l1.4-6.7-5-4.6 6.7-.8z"/></svg>',
  wand: S('<path d="M5 19L16 8M14 6l4 4M18 3v3M16.5 4.5h3M6 5v2M5 6h2M19 14v2M18 15h2"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  launch: S('<path d="M4 18c5 0 9-3 11-9M15 9l-4.2.8M15 9l1.4 4"/><circle cx="18.5" cy="5.5" r="2"/>'),
  catch: S('<path d="M5 10h14l-2 9H7z"/><path d="M12 3v4M9.5 5.5L12 8l2.5-2.5"/>'),
} as const;
