const PATHS: Record<string, string> = {
  house: 'M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9',
  wallet: 'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm14 5h2v3h-2a1.5 1.5 0 0 1 0-3Z',
  basket: 'M4 9h16l-1.5 9.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 9Zm3 0 2-5h6l2 5M10 13v3m4-3v3',
  car: 'M5 16V9l2-4h10l2 4v7M3 16h18M6 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm8 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  card: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 4h18',
  bank: 'M3 10 12 4l9 6M4 10h16v9H4v-9Zm3 0v9m4-9v9m4-9v9m4-9v9M3 21h18',
  tag: 'M11 4h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1 0-2.8l8-8A2 2 0 0 1 11 4Zm4 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  plus: 'M12 5v14M5 12h14',
  chevronLeft: 'm15 6-6 6 6 6',
  chevronRight: 'm9 6 6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 13 4 4 10-10',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm9 2-4.35-4.35',
  more: 'M5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
};

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

/** Small inline line-icon set — no icon library dependency. Unknown names fall back to a dot. */
export default function Icon({ name, size = 20, className }: IconProps) {
  const d = PATHS[name] ?? 'M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
