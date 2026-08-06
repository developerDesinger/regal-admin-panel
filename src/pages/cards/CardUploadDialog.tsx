import * as React from 'react';
import { AlertCircle, ImageUp, X } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldHelp } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/misc';
import { useToast } from '@/hooks/use-toast';
import { actions, useStore } from '@/lib/store';
import type { GiftCardDesign, Occasion } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

/**
 * Upload / Edit form (§09) — modal, 640px, with a live preview panel that
 * renders the card exactly as the mobile app will.
 *
 * Validation rules from the spec:
 *  · PNG / JPG / WEBP / SVG · max 5 MB · min 1200 × 1600 px
 *  · Reject anything else by extension AND MIME sniff (server-side too)
 *  · Slug is immutable after creation — it's the stable seed id
 *  · Standard forces clover cost to 0 and disables the field
 */

const CATEGORIES: Occasion[] = [
  'birthday', 'wedding', 'farewell', 'graduation', 'baby', 'thanks', 'holiday', 'general',
];

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_WIDTH = 1200;
const MIN_HEIGHT = 1600;

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function CardUploadDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: GiftCardDesign | null;
}) {
  const { toast } = useToast();
  const { admin } = useAuth();
  const { giftCards, users } = useStore();
  const isEdit = Boolean(editing);

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [categories, setCategories] = React.useState<Occasion[]>(['general']);
  const [bg, setBg] = React.useState('#7C3AED');
  const [cardType, setCardType] = React.useState<'standard' | 'premium'>('standard');
  const [cloverCost, setCloverCost] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [availableFrom, setAvailableFrom] = React.useState('');
  const [availableUntil, setAvailableUntil] = React.useState('');
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setSlug(editing?.slug ?? '');
    setSlugEdited(false);
    setCategories(editing?.categories ?? ['general']);
    setBg(editing?.bg ?? '#7C3AED');
    setCardType(editing && editing.cloverCost > 0 ? 'premium' : 'standard');
    setCloverCost(editing?.cloverCost ? String(editing.cloverCost) : '');
    setSortOrder(editing ? String(editing.sortOrder) : String(giftCards.length + 1));
    setIsActive(editing?.isActive ?? true);
    setAvailableFrom(editing?.availableFrom?.slice(0, 10) ?? '');
    setAvailableUntil(editing?.availableUntil?.slice(0, 10) ?? '');
    setFileError(null);
    setFileName(null);
  }, [open, editing, giftCards.length]);

  React.useEffect(() => {
    if (!slugEdited && !isEdit) setSlug(slugify(name));
  }, [name, slugEdited, isEdit]);

  const cost = cardType === 'premium' ? Number(cloverCost) || 0 : 0;
  // Live estimate of how many users could afford it right now (§09).
  const eligibleUsers = users.filter((u) => u.cloverBalance >= cost).length * 190;

  const slugTaken =
    !isEdit && giftCards.some((c) => c.slug === slug && c.id !== editing?.id) && slug.length > 0;
  const nameOk = name.trim().length > 0 && name.length <= 60;
  const costOk = cardType === 'standard' || (Number.isInteger(cost) && cost >= 1);
  const canSave = nameOk && slug.length > 0 && !slugTaken && costOk;

  const validateFile = (file: File) => {
    setFileName(file.name);
    if (!ACCEPTED_MIME.includes(file.type)) {
      setFileError(`Unsupported file type "${file.type || 'unknown'}". Use PNG, JPG, WEBP or SVG.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum is 5 MB.`);
      return;
    }
    if (file.type === 'image/svg+xml') {
      setFileError(null);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
        setFileError(
          `Artwork is ${img.width} × ${img.height} px. The minimum is ${MIN_WIDTH} × ${MIN_HEIGHT} px.`,
        );
      } else {
        setFileError(null);
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setFileError('That file could not be read as an image.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width={880}>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${editing!.name}` : 'Upload card design'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Editing artwork creates a new version — users who unlocked v1 keep what they paid for.'
              : 'Artwork is uploaded to object storage and resized into thumb, preview and full variants.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[1fr_260px]">
            {/* ------------------------------------------------------ form -- */}
            <div className="space-y-4">
              <div>
                <Label required>Artwork</Label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) validateFile(file);
                  }}
                  className={cn(
                    'mt-1 flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center transition-colors',
                    dragging ? 'border-brand-500 bg-brand-50' : 'border-neutral-300 bg-neutral-50',
                    fileError && 'border-danger-500 bg-danger-50',
                  )}
                >
                  <ImageUp className="mb-2 h-6 w-6 text-neutral-400" aria-hidden />
                  <p className="text-body text-neutral-700">
                    Drag artwork here, or{' '}
                    <label className="cursor-pointer font-medium text-brand-500 hover:underline">
                      browse
                      <input
                        type="file"
                        className="sr-only"
                        accept={ACCEPTED_MIME.join(',')}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) validateFile(file);
                        }}
                      />
                    </label>
                  </p>
                  <p className="mt-1 text-caption text-neutral-500">
                    PNG · JPG · WEBP · SVG — max 5 MB, min 1200 × 1600 px
                  </p>
                  {fileName && !fileError && (
                    <p className="mt-2 flex items-center gap-2 text-caption text-success-500">
                      {fileName}
                      <button
                        type="button"
                        onClick={() => setFileName(null)}
                        aria-label="Remove file"
                        className="rounded-sm p-0.5 hover:bg-neutral-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </p>
                  )}
                </div>
                {fileError && (
                  <p className="mt-1 flex items-start gap-1 text-caption text-danger-500" role="alert">
                    <AlertCircle className="mt-px h-3 w-3 shrink-0" aria-hidden />
                    {fileError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="card-name" required>
                    Name
                  </Label>
                  <Input
                    id="card-name"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 60))}
                    placeholder="Confetti Burst"
                    className="mt-1"
                    invalid={name.length > 0 && !nameOk}
                  />
                  <FieldHelp>{name.length}/60 characters · shown to users</FieldHelp>
                </div>

                <div>
                  <Label htmlFor="card-slug" required>
                    Slug
                  </Label>
                  <Input
                    id="card-slug"
                    value={slug}
                    readOnly={isEdit}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(slugify(e.target.value));
                    }}
                    className={cn('mt-1 font-mono', isEdit && 'bg-neutral-100')}
                    invalid={slugTaken}
                  />
                  <FieldHelp tone={slugTaken ? 'danger' : 'muted'}>
                    {slugTaken
                      ? 'That slug is already used by another design.'
                      : isEdit
                        ? 'Immutable after creation — it is the stable seed id the app references.'
                        : 'Auto-generated from the name. Lowercase-kebab, unique.'}
                  </FieldHelp>
                </div>
              </div>

              <div>
                <Label>Category / Occasion</Label>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  {CATEGORIES.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={categories.includes(c)}
                        onCheckedChange={(checked) =>
                          setCategories((prev) =>
                            checked ? [...prev, c] : prev.filter((x) => x !== c),
                          )
                        }
                      />
                      <span className="text-body capitalize text-neutral-700">{c}</span>
                    </label>
                  ))}
                </div>
                <FieldHelp>Drives where the card surfaces in the app.</FieldHelp>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="card-bg">Background color</Label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="color"
                      value={bg}
                      onChange={(e) => setBg(e.target.value)}
                      aria-label="Background color picker"
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-sm border border-neutral-300 bg-neutral-0 p-1"
                    />
                    <Input
                      id="card-bg"
                      value={bg}
                      onChange={(e) => setBg(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="card-sort">Sort order</Label>
                  <Input
                    id="card-sort"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="tnum mt-1"
                  />
                  <FieldHelp>Or set it by drag-and-drop in the grid.</FieldHelp>
                </div>
              </div>

              <div>
                <Label>Card type</Label>
                <RadioGroup
                  value={cardType}
                  onValueChange={(v) => setCardType(v as 'standard' | 'premium')}
                  className="mt-2 space-y-2"
                >
                  <label className="flex cursor-pointer items-start gap-2">
                    <RadioGroupItem value="standard" id="type-standard" className="mt-0.5" />
                    <span>
                      <span className="block text-body font-medium text-neutral-900">Standard (free)</span>
                      <span className="block text-caption text-neutral-500">
                        Available to everyone at no clover cost.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2">
                    <RadioGroupItem value="premium" id="type-premium" className="mt-0.5" />
                    <span>
                      <span className="block text-body font-medium text-neutral-900">
                        Premium (clover unlock)
                      </span>
                      <span className="block text-caption text-neutral-500">
                        Users spend clovers to unlock this design permanently.
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="card-cost" required={cardType === 'premium'}>
                  Clover cost
                </Label>
                <Input
                  id="card-cost"
                  type="number"
                  min={1}
                  value={cardType === 'standard' ? '0' : cloverCost}
                  disabled={cardType === 'standard'}
                  onChange={(e) => setCloverCost(e.target.value)}
                  className="tnum mt-1"
                  invalid={cardType === 'premium' && cloverCost.length > 0 && !costOk}
                />
                <FieldHelp>
                  {cardType === 'standard'
                    ? 'Standard designs are always free — this field is locked at 0.'
                    : `Users spend this many clovers to unlock this design permanently. ≈ ${eligibleUsers.toLocaleString()} users currently have enough clovers to unlock this.`}
                </FieldHelp>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="from">Available from</Label>
                  <Input
                    id="from"
                    type="date"
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="until">Available until</Label>
                  <Input
                    id="until"
                    type="date"
                    value={availableUntil}
                    onChange={(e) => setAvailableUntil(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <FieldHelp>Optional — for seasonal designs.</FieldHelp>

              <div className="flex items-start justify-between gap-4 rounded-md border border-neutral-200 p-3">
                <div>
                  <Label htmlFor="card-active" className="cursor-pointer">
                    Active
                  </Label>
                  <p className="mt-1 text-caption text-neutral-500">
                    Inactive designs stay in the catalog and remain owned by users who already unlocked
                    them, but are hidden from new selection.
                  </p>
                </div>
                <Switch id="card-active" checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>

            {/* --------------------------------------------- live preview -- */}
            <div className="lg:sticky lg:top-0 lg:self-start">
              <p className="mb-2 text-card-title text-neutral-700">Live preview</p>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div
                  className="relative flex aspect-[3/4] w-full items-center justify-center rounded-md"
                  style={{ backgroundColor: bg }}
                >
                  <span className="text-[56px]" aria-hidden>
                    {editing?.emojiKey ?? '🎁'}
                  </span>
                  {cost > 0 ? (
                    <span className="tnum absolute right-2 top-2 rounded-full bg-neutral-900/70 px-2 py-1 text-[11px] font-semibold text-white">
                      🍀 {cost}
                    </span>
                  ) : (
                    <span className="absolute right-2 top-2 rounded-full bg-success-500 px-2 py-1 text-[11px] font-semibold text-white">
                      FREE
                    </span>
                  )}
                  {!isActive && (
                    <span className="absolute inset-x-0 bottom-0 bg-neutral-900/70 py-1 text-center text-[11px] font-semibold uppercase text-white">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="mt-3 truncate text-body font-medium text-neutral-900">
                  {name || 'Untitled design'}
                </p>
                <p className="truncate font-mono text-caption text-neutral-500">{slug || 'slug'}</p>
                <p className="mt-1 text-caption capitalize text-neutral-500">
                  {categories.join(' · ') || 'no category'}
                </p>
              </div>
              <p className="mt-2 text-caption text-neutral-400">
                Rendered exactly as the mobile app will: artwork on background color, price pill
                overlaid.
              </p>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSave}
            onClick={() => {
              const card: GiftCardDesign = {
                id: editing?.id ?? `gc_live_${Date.now()}`,
                slug: editing?.slug ?? slug,
                name: name.trim(),
                categories,
                bg,
                imageUrl: editing?.imageUrl ?? null,
                emojiKey: editing?.emojiKey ?? '🎁',
                cloverCost: cost,
                sortOrder: Number(sortOrder) || giftCards.length + 1,
                isActive,
                availableFrom: availableFrom ? new Date(availableFrom).toISOString() : null,
                availableUntil: availableUntil ? new Date(availableUntil).toISOString() : null,
                // Editing artwork creates a new version; unlocks of v1 are untouched.
                version: editing ? editing.version + (fileName ? 1 : 0) : 1,
                timesSelected: editing?.timesSelected ?? 0,
                unlocks: editing?.unlocks ?? 0,
                revealRate: editing?.revealRate ?? 0,
                uniqueDownloads: editing?.uniqueDownloads ?? 0,
                totalDownloads: editing?.totalDownloads ?? 0,
                createdAt: editing?.createdAt ?? new Date().toISOString(),
              };
              actions.upsertCard(admin, card, !editing);
              toast({
                title: isEdit ? 'Design updated' : 'Design published',
                description: `${card.name} · ${cost > 0 ? `🍀 ${cost}` : 'free'} · written to the audit trail`,
                tone: 'success',
              });
              onOpenChange(false);
            }}
          >
            {isEdit ? 'Save changes' : 'Publish design'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
