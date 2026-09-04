import { useTranslation } from 'react-i18next';
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
import { CardArtwork } from './CardArtwork';
import { catalogService, uploadArtwork } from '@/lib/api/services';
import { useCardCategories, useCatalog } from '@/hooks/data';
import { useQueryClient } from '@tanstack/react-query';
import type { GiftCardDesign } from '@/lib/types';
import { ApiError } from '@/lib/api/client';
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const { rows: giftCards } = useCatalog();
  /**
   * The occasions a design can be filed under, straight from the category
   * manager. This was a nine-key list compiled into the panel, which is why
   * categories the apps do use — Teacher's Day, XV's, Baptism — could not be
   * picked at all, and a card meant for one of them had to be filed elsewhere.
   * Only active categories are offered; a retired one already on a design is
   * added back below so editing that design does not silently drop the tag.
   */
  const { rows: categoryRows } = useCardCategories();
  const qc = useQueryClient();
  const isEdit = Boolean(editing);

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugEdited, setSlugEdited] = React.useState(false);
  /**
   * The category keys this design is filed under.
   *
   * Empty by default, and required before saving. It used to default to
   * `general`, which silently added that tag to every design an admin created
   * — so a card ticked "Birthday" was saved as both, and the apps, which read
   * the first tag, showed it as General.
   */
  const [categories, setCategories] = React.useState<string[]>([]);
  const [bg, setBg] = React.useState('#7C3AED');
  const [cardType, setCardType] = React.useState<'standard' | 'premium'>('standard');
  const [cloverCost, setCloverCost] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [availableFrom, setAvailableFrom] = React.useState('');
  const [availableUntil, setAvailableUntil] = React.useState('');
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  // The bytes themselves, needed for the upload on save.
  const [file, setFile] = React.useState<File | null>(null);
  /**
   * Object URL of the picked file, so the preview shows the artwork that is
   * about to be published rather than a placeholder. Revoked whenever it is
   * replaced and when the dialog closes — an object URL is a live handle on the
   * file, not a copy of it.
   */
  const [filePreview, setFilePreview] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setSlug(editing?.slug ?? '');
    setSlugEdited(false);
    setCategories(editing?.categories ?? []);
    setBg(editing?.bg ?? '#7C3AED');
    setCardType(editing && editing.cloverCost > 0 ? 'premium' : 'standard');
    setCloverCost(editing?.cloverCost ? String(editing.cloverCost) : '');
    setSortOrder(editing ? String(editing.sortOrder) : String(giftCards.length + 1));
    setIsActive(editing?.isActive ?? true);
    setAvailableFrom(editing?.availableFrom?.slice(0, 10) ?? '');
    setAvailableUntil(editing?.availableUntil?.slice(0, 10) ?? '');
    setFileError(null);
    setFileName(null);
    setFile(null);
    setFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open, editing, giftCards.length]);

  // Release the last object URL when the dialog unmounts.
  React.useEffect(
    () => () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    },
    [filePreview],
  );

  React.useEffect(() => {
    if (!slugEdited && !isEdit) setSlug(slugify(name));
  }, [name, slugEdited, isEdit]);

  const cost = cardType === 'premium' ? Number(cloverCost) || 0 : 0;
  // Live estimate of how many users could afford it right now (§09) — the
  // server counts it, debounced so typing a price doesn't spam the endpoint.
  const [eligibleUsers, setEligibleUsers] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (cost <= 0) {
      setEligibleUsers(null);
      return;
    }
    const t = setTimeout(() => {
      catalogService
        .eligibleCount(cost)
        .then((r) => setEligibleUsers(r.eligibleUsers))
        .catch(() => setEligibleUsers(null));
    }, 350);
    return () => clearTimeout(t);
  }, [cost]);

  const slugTaken =
    !isEdit && giftCards.some((c) => c.slug === slug && c.id !== editing?.id) && slug.length > 0;
  const nameOk = name.trim().length > 0 && name.length <= 60;
  const costOk = cardType === 'standard' || (Number.isInteger(cost) && cost >= 1);
  // What the preview should show: the file being published, else what this
  // design already has, else nothing (the emoji placeholder takes over).
  const artwork = filePreview ?? editing?.imageUrl ?? null;
  // A rejected file must not reach Publish — the upload would fail on the
  // server for the same reason it was rejected here. Artwork is marked required
  // on a new design, so an empty picker blocks it too.
  const artworkOk = !fileError && (isEdit || Boolean(file));
  // At least one category, because an untagged design is invisible in every
  // occasion-filtered picker in the apps.
  const categoriesOk = categories.length > 0;
  const canSave =
    nameOk && slug.length > 0 && !slugTaken && costOk && artworkOk && categoriesOk;

  /** Active categories in the admin's order, plus any retired tag this design already carries. */
  const categoryOptions = React.useMemo(() => {
    const options = categoryRows
      .filter((c) => c.isActive)
      .map((c) => ({ key: c.key, label: c.name }));
    const known = new Set(options.map((o) => o.key));
    return [
      ...options,
      ...categories.filter((key) => !known.has(key)).map((key) => {
        const row = categoryRows.find((c) => c.key === key);
        return { key, label: row?.name ?? key };
      }),
    ];
  }, [categoryRows, categories]);

  /** A key's display name, for the preview line. */
  const categoryLabel = React.useCallback(
    (key: string) => categoryOptions.find((o) => o.key === key)?.label ?? key,
    [categoryOptions],
  );

  const validateFile = (file: File) => {
    setFileName(file.name);
    setFile(file);
    setFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    if (!ACCEPTED_MIME.includes(file.type)) {
      setFileError(
        t('cards.upload.unsupportedType', {
          type: file.type || t('cards.upload.unknownType'),
        }),
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError(t('cards.upload.tooLarge', { size: (file.size / 1024 / 1024).toFixed(1) }));
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
          t('cards.upload.tooSmall', {
            width: img.width,
            height: img.height,
            minWidth: MIN_WIDTH,
            minHeight: MIN_HEIGHT,
          }),
        );
      } else {
        setFileError(null);
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setFileError(t('cards.upload.notAnImage'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width={880}>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('cards.upload.editTitle', { name: editing!.name })
              : t('cards.upload.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t('cards.upload.editSubtitle') : t('cards.upload.createSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[1fr_260px]">
            {/* ------------------------------------------------------ form -- */}
            <div className="space-y-4">
              <div>
                <Label required>{t('cards.upload.artwork')}</Label>
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
                    {t('cards.upload.dragHere')}{' '}
                    <label className="cursor-pointer font-medium text-brand-500 hover:underline">
                      {t('cards.upload.browse')}
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
                    {t('cards.upload.constraints')}
                  </p>
                  {fileName && !fileError && (
                    <p className="mt-2 flex items-center gap-2 text-caption text-success-500">
                      {fileName}
                      <button
                        type="button"
                        onClick={() => {
                          setFileName(null);
                          setFile(null);
                          setFilePreview((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return null;
                          });
                        }}
                        aria-label={t('cards.upload.removeFile')}
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
                    {t('cards.upload.name')}
                  </Label>
                  <Input
                    id="card-name"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 60))}
                    placeholder={t('cards.upload.namePlaceholder')}
                    className="mt-1"
                    invalid={name.length > 0 && !nameOk}
                  />
                  <FieldHelp>{t('cards.upload.nameHelp', { count: name.length })}</FieldHelp>
                </div>

                <div>
                  <Label htmlFor="card-slug" required>
                    {t('cards.upload.slug')}
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
                      ? t('cards.upload.slugTaken')
                      : isEdit
                        ? t('cards.upload.slugImmutable')
                        : t('cards.upload.slugAuto')}
                  </FieldHelp>
                </div>
              </div>

              <div>
                <Label>{t('cards.upload.categoryLabel')}</Label>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  {categoryOptions.map((c) => (
                    <label key={c.key} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={categories.includes(c.key)}
                        onCheckedChange={(checked) =>
                          setCategories((prev) =>
                            checked
                              ? [...new Set([...prev, c.key])]
                              : prev.filter((x) => x !== c.key),
                          )
                        }
                      />
                      <span className="text-body text-neutral-700">{c.label}</span>
                    </label>
                  ))}
                </div>
                <FieldHelp>
                  {categoriesOk
                    ? t('cards.upload.categoryHelp')
                    : t('cards.upload.categoryRequired')}
                </FieldHelp>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="card-bg">{t('cards.upload.background')}</Label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="color"
                      value={bg}
                      onChange={(e) => setBg(e.target.value)}
                      aria-label={t('cards.upload.backgroundPicker')}
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
                  <Label htmlFor="card-sort">{t('cards.upload.sortOrder')}</Label>
                  <Input
                    id="card-sort"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="tnum mt-1"
                  />
                  <FieldHelp>{t('cards.upload.sortOrderHelp')}</FieldHelp>
                </div>
              </div>

              <div>
                <Label>{t('cards.upload.cardType')}</Label>
                <RadioGroup
                  value={cardType}
                  onValueChange={(v) => setCardType(v as 'standard' | 'premium')}
                  className="mt-2 space-y-2"
                >
                  <label className="flex cursor-pointer items-start gap-2">
                    <RadioGroupItem value="standard" id="type-standard" className="mt-0.5" />
                    <span>
                      <span className="block text-body font-medium text-neutral-900">
                        {t('cards.upload.standardTitle')}
                      </span>
                      <span className="block text-caption text-neutral-500">
                        {t('cards.upload.standardBody')}
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2">
                    <RadioGroupItem value="premium" id="type-premium" className="mt-0.5" />
                    <span>
                      <span className="block text-body font-medium text-neutral-900">
                        {t('cards.upload.premiumTitle')}
                      </span>
                      <span className="block text-caption text-neutral-500">
                        {t('cards.upload.premiumBody')}
                      </span>
                    </span>
                  </label>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="card-cost" required={cardType === 'premium'}>
                  {t('cards.upload.cloverCost')}
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
                    ? t('cards.upload.standardLocked')
                    : t('cards.upload.premiumHelp', {
                        count: (eligibleUsers ?? 0).toLocaleString(),
                      })}
                </FieldHelp>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="from">{t('cards.upload.availableFrom')}</Label>
                  <Input
                    id="from"
                    type="date"
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="until">{t('cards.upload.availableUntil')}</Label>
                  <Input
                    id="until"
                    type="date"
                    value={availableUntil}
                    onChange={(e) => setAvailableUntil(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <FieldHelp>{t('cards.upload.seasonalHelp')}</FieldHelp>

              <div className="flex items-start justify-between gap-4 rounded-md border border-neutral-200 p-3">
                <div>
                  <Label htmlFor="card-active" className="cursor-pointer">
                    {t('cards.upload.active')}
                  </Label>
                  <p className="mt-1 text-caption text-neutral-500">{t('cards.upload.activeHelp')}</p>
                </div>
                <Switch id="card-active" checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>

            {/* --------------------------------------------- live preview -- */}
            <div className="lg:sticky lg:top-0 lg:self-start">
              <p className="mb-2 text-card-title text-neutral-700">{t('cards.upload.livePreview')}</p>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                {/* Same swatch the catalog and detail screens draw, so the
                    preview is the design as it will actually be listed: the
                    picked file first, then this design's published artwork,
                    then its key — laid out as a word when it is one. */}
                <CardArtwork
                  card={{ bg, imageUrl: artwork, emojiKey: editing?.emojiKey ?? '🎁' }}
                  scale="md"
                  className="aspect-[3/4] w-full rounded-md"
                >
                  {cost > 0 ? (
                    <span className="tnum absolute right-2 top-2 rounded-full bg-neutral-900/70 px-2 py-1 text-[11px] font-semibold text-white">
                      🍀 {cost}
                    </span>
                  ) : (
                    <span className="absolute right-2 top-2 rounded-full bg-success-500 px-2 py-1 text-[11px] font-semibold text-white">
                      {t('cards.freeUpper')}
                    </span>
                  )}
                  {!isActive && (
                    <span className="absolute inset-x-0 bottom-0 bg-neutral-900/70 py-1 text-center text-[11px] font-semibold uppercase text-white">
                      {t('cards.inactive')}
                    </span>
                  )}
                </CardArtwork>
                <p className="mt-3 truncate text-body font-medium text-neutral-900">
                  {name || t('cards.upload.untitled')}
                </p>
                <p className="truncate font-mono text-caption text-neutral-500">{slug || 'slug'}</p>
                <p className="mt-1 text-caption text-neutral-500">
                  {categories.map(categoryLabel).join(' · ') || t('cards.upload.noCategory')}
                </p>
              </div>
              <p className="mt-2 text-caption text-neutral-400">{t('cards.upload.previewNote')}</p>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!canSave}
            onClick={async () => {
              try {
                // Artwork is never mutated in place — supplying a new assetId
                // creates a new version, so v1 unlockers keep what they paid for.
                const assetId = file ? await uploadArtwork(file) : undefined;
                const payload = {
                  assetId,
                  name: name.trim(),
                  categories,
                  bg,
                  tier: cardType,
                  cloverCost: cost,
                  sortOrder: Number(sortOrder) || undefined,
                  isActive,
                  availableFrom: availableFrom ? new Date(availableFrom).toISOString() : null,
                  availableUntil: availableUntil ? new Date(availableUntil).toISOString() : null,
                };
                const card = editing
                  ? await catalogService.update(editing.id, payload)
                  : await catalogService.create({ ...payload, slug });
                void qc.invalidateQueries({ queryKey: ['catalog'] });
              toast({
                title: isEdit ? t('cards.upload.updated') : t('cards.upload.published'),
                description: t('cards.upload.savedBody', {
                  name: card.name,
                  price: cost > 0 ? `🍀 ${cost}` : t('cards.upload.freeLower'),
                }),
                tone: 'success',
              });
                onOpenChange(false);
              } catch (err) {
                toast({
                  title: isEdit
                    ? t('cards.upload.updateFailed')
                    : t('cards.upload.publishFailed'),
                  description: (err as ApiError).message,
                  tone: 'danger',
                });
              }
            }}
          >
            {isEdit ? t('common.saveChanges') : t('cards.upload.publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
