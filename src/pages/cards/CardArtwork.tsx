import type { GiftCardDesign } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * The artwork swatch every card surface draws — table row, grid tile, detail
 * panel — so all three agree on what a design looks like.
 *
 * Three cases, in order:
 *
 *  1. The design has uploaded artwork. Show it. This is a *card catalog*, so
 *     the art is the point, and it was previously never rendered anywhere.
 *  2. `emojiKey` is an actual emoji. Show it at the box's size.
 *  3. `emojiKey` is a word — the seeded designs carry keys like "cake",
 *     "sparkle" and "butterfly". Rendered at the emoji's size, those ran
 *     straight out of the swatch and over the design name beside it, which is
 *     the overflow in the catalog table. A word is laid out as a word: sized to
 *     the box, clipped, and inked for contrast against whatever background
 *     colour the design carries.
 */

/** True for a real pictograph; false for a word-shaped key like "butterfly". */
function isEmoji(value: string): boolean {
  return /\p{Extended_Pictographic}/u.test(value);
}

/**
 * Readable ink over an author-supplied background.
 *
 * `bg` is content, not a design token — it ranges from near-white (#FDF2F8) to
 * near-black (#1F2937) across the seeded designs, so a fixed text colour is
 * unreadable on one end or the other. Rec. 709 luma is the usual proxy for
 * perceived lightness.
 */
function inkFor(bg: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(bg.trim());
  if (!match) return '#111827';
  const value = parseInt(match[1]!, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.6 ? '#111827' : '#FFFFFF';
}

const SCALES = {
  sm: { emoji: 'text-[18px]', word: 'text-[9px] leading-tight' },
  md: { emoji: 'text-[44px]', word: 'text-[13px] leading-tight' },
  lg: { emoji: 'text-[72px]', word: 'text-[18px] leading-tight' },
} as const;

export function CardArtwork({
  card,
  scale = 'sm',
  className,
  children,
}: {
  card: Pick<GiftCardDesign, 'bg' | 'imageUrl' | 'emojiKey'>;
  scale?: keyof typeof SCALES;
  /** Box geometry — size, aspect and corner radius belong to the caller. */
  className?: string;
  /** Overlays drawn on top of the art, e.g. the price or an "inactive" ribbon. */
  children?: React.ReactNode;
}) {
  const label = (card.emojiKey ?? '').trim();
  const sizes = SCALES[scale];

  return (
    <div
      className={cn('relative flex items-center justify-center overflow-hidden', className)}
      style={{ backgroundColor: card.bg }}
    >
      {card.imageUrl ? (
        <img src={card.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : isEmoji(label) ? (
        <span className={cn('leading-none', sizes.emoji)} aria-hidden>
          {label}
        </span>
      ) : label ? (
        <span
          className={cn('max-w-full truncate px-1 font-medium uppercase tracking-wide', sizes.word)}
          style={{ color: inkFor(card.bg) }}
          aria-hidden
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}
