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
import { Input, Textarea } from '@/components/ui/input';
import { Label, FieldHelp } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { categoriesService } from '@/lib/api/services';
import { useQueryClient } from '@tanstack/react-query';
import type { CardCategoryRow } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

/**
 * Create / edit one category (§09) — the occasion vocabulary the apps group
 * designs and events by.
 *
 * Two rules the API enforces and this form makes visible rather than letting an
 * admin discover them as errors:
 *
 *  · `key` is immutable. Every design tagged with the category and every event
 *    whose occasion it is reference the key, so changing it would orphan them.
 *    Renaming means the display names, which is what "rename" actually means.
 *  · Artwork is posted inline as a base64 `data:` URI on this same request —
 *    a glyph is small, and there is then no half-uploaded asset left behind if
 *    the dialog is closed.
 */

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
/** Matches MAX_CATEGORY_IMAGE_BYTES on the server. */
const MAX_BYTES = 3 * 1024 * 1024;
/** Matches MIN_CATEGORY_IMAGE_PX — low enough for a 128px app icon. */
const MIN_PX = 128;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** One upload slot: the picked file, its data URI, and the "clear it" flag. */
interface ArtworkSlot {
  dataUri: string | null;
  type: string | null;
  fileName: string | null;
  error: string | null;
  remove: boolean;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  setRemove: (v: boolean) => void;
  accept: (file: File) => Promise<void>;
  clear: () => void;
  reset: () => void;
}

/**
 * The picking and validating half of an artwork field.
 *
 * A hook rather than one more block of state per picture: the dialog now
 * carries two — the row glyph and the cow — and they validate identically, so
 * a second copy of this logic would be a second place for the rules to drift.
 */
function useArtwork(): ArtworkSlot {
  const { t } = useTranslation();
  const [dataUri, setDataUri] = React.useState<string | null>(null);
  const [type, setType] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [remove, setRemove] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  const accept = React.useCallback(
    async (file: File) => {
      setFileName(file.name);
      if (!ACCEPTED_MIME.includes(file.type)) {
        setDataUri(null);
        setError(
          t('cards.categories.unsupportedType', {
            type: file.type || t('cards.upload.unknownType'),
          }),
        );
        return;
      }
      if (file.size > MAX_BYTES) {
        setDataUri(null);
        setError(t('cards.categories.tooLarge', { size: (file.size / 1024 / 1024).toFixed(1) }));
        return;
      }

      // SVG is resolution-independent, so there is no pixel floor to check.
      if (file.type !== 'image/svg+xml') {
        const dimensions = await new Promise<{ width: number; height: number } | null>(
          (resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
              resolve({ width: img.width, height: img.height });
              URL.revokeObjectURL(url);
            };
            img.onerror = () => {
              resolve(null);
              URL.revokeObjectURL(url);
            };
            img.src = url;
          },
        );
        if (!dimensions) {
          setDataUri(null);
          setError(t('cards.upload.notAnImage'));
          return;
        }
        if (dimensions.width < MIN_PX || dimensions.height < MIN_PX) {
          setDataUri(null);
          setError(
            t('cards.categories.tooSmall', {
              width: dimensions.width,
              height: dimensions.height,
              min: MIN_PX,
            }),
          );
          return;
        }
      }

      try {
        setDataUri(await readAsDataUri(file));
        setType(file.type);
        setError(null);
        // Picking a file is the opposite of clearing one.
        setRemove(false);
      } catch {
        setDataUri(null);
        setError(t('cards.upload.notAnImage'));
      }
    },
    [t],
  );

  const clear = React.useCallback(() => {
    setFileName(null);
    setDataUri(null);
    setType(null);
    setError(null);
  }, []);

  const reset = React.useCallback(() => {
    clear();
    setRemove(false);
    setDragging(false);
  }, [clear]);

  return {
    dataUri,
    type,
    fileName,
    error,
    remove,
    dragging,
    setDragging,
    setRemove,
    accept,
    clear,
    reset,
  };
}

/** One drag-and-drop artwork field, bound to a slot from `useArtwork`. */
function ArtworkField({
  label,
  help,
  slot,
  current,
  removeLabel,
}: {
  label: string;
  help: string;
  slot: ArtworkSlot;
  /** The stored image this field would replace, if the category has one. */
  current: string | null;
  removeLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <Label>{label}</Label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          slot.setDragging(true);
        }}
        onDragLeave={() => slot.setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          slot.setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void slot.accept(file);
        }}
        className={cn(
          'mt-1 flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center transition-colors',
          slot.dragging ? 'border-brand-500 bg-brand-50' : 'border-neutral-300 bg-neutral-50',
          slot.error && 'border-danger-500 bg-danger-50',
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
                if (file) void slot.accept(file);
              }}
            />
          </label>
        </p>
        <p className="mt-1 text-caption text-neutral-500">{help}</p>
        {slot.fileName && !slot.error && (
          <p className="mt-2 flex items-center gap-2 text-caption text-success-500">
            {slot.fileName}
            <button
              type="button"
              onClick={slot.clear}
              aria-label={t('cards.upload.removeFile')}
              className="rounded-sm p-0.5 hover:bg-neutral-100"
            >
              <X className="h-3 w-3" />
            </button>
          </p>
        )}
      </div>
      {slot.error && (
        <p className="mt-1 flex items-start gap-1 text-caption text-danger-500" role="alert">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          {slot.error}
        </p>
      )}
      {current && !slot.dataUri && (
        <label className="mt-2 flex items-center gap-2 text-caption text-neutral-600">
          <input
            type="checkbox"
            checked={slot.remove}
            onChange={(e) => slot.setRemove(e.target.checked)}
          />
          {removeLabel}
        </label>
      )}
    </div>
  );
}

/** The server's KEY_PATTERN, restated so the field can validate as it is typed. */
const KEY_PATTERN = /^[a-z][a-zA-Z0-9]{1,39}$/;

/**
 * "Baby Shower" → "babyShower". camelCase because that is the vocabulary the
 * mobile app's bundled icons and its `occasion` values already use.
 */
function keyify(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  const [first, ...rest] = words;
  return (
    first!.toLowerCase() + rest.map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join('')
  ).slice(0, 40);
}

/** Reads a picked file as the base64 `data:` URI the API expects. */
function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('unreadable'));
    reader.readAsDataURL(file);
  });
}

export function CategoryDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: CardCategoryRow | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = Boolean(editing);

  const [name, setName] = React.useState('');
  const [nameEs, setNameEs] = React.useState('');
  const [key, setKey] = React.useState('');
  const [keyEdited, setKeyEdited] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [color, setColor] = React.useState('#7C3AED');
  const [emoji, setEmoji] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Two pictures, each with its own upload state: the small glyph beside a row
  // and the cow the mobile app draws on its large category tiles.
  const icon = useArtwork();
  const cow = useArtwork();

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setNameEs(editing?.nameEs ?? '');
    setKey(editing?.key ?? '');
    setKeyEdited(false);
    setDescription(editing?.description ?? '');
    setColor(editing?.color ?? '#7C3AED');
    setEmoji(editing?.emoji ?? '');
    setIsActive(editing?.isActive ?? true);
    icon.reset();
    cow.reset();
    setSaving(false);
    // The two upload slots are stable objects from `useArtwork`; listing them
    // here would re-run the reset on every keystroke they record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // The key is derived from the name until an admin types one, and never on an
  // edit — there the field is locked to what designs already reference.
  React.useEffect(() => {
    if (!isEdit && !keyEdited) setKey(keyify(name));
  }, [name, keyEdited, isEdit]);

  const nameOk = name.trim().length > 0 && name.trim().length <= 60;
  const keyOk = isEdit || KEY_PATTERN.test(key);
  const colorOk = HEX_COLOR.test(color);
  const canSave = nameOk && keyOk && colorOk && !icon.error && !cow.error && !saving;

  const currentIcon = editing?.images.icon ?? null;
  const currentCow = editing?.images.cow ?? null;
  const previewImage = icon.dataUri ?? (icon.remove ? null : currentIcon);
  const previewCow = cow.dataUri ?? (cow.remove ? null : currentCow);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        // An empty box is an explicit "no Spanish name" — the API reads null as
        // clearing it, and the apps then fall back to `name`.
        nameEs: nameEs.trim() || null,
        description: description.trim() || null,
        color,
        emoji: emoji.trim() || null,
        isActive,
        ...(icon.dataUri
          ? { image: icon.dataUri, imageContentType: icon.type ?? 'image/png' }
          : {}),
        ...(icon.remove && !icon.dataUri ? { removeImage: true } : {}),
        ...(cow.dataUri
          ? { cowImage: cow.dataUri, cowImageContentType: cow.type ?? 'image/png' }
          : {}),
        ...(cow.remove && !cow.dataUri ? { removeCowImage: true } : {}),
      };
      const saved = editing
        ? await categoriesService.update(editing.id, payload)
        : await categoriesService.create({ ...payload, key });
      void qc.invalidateQueries({ queryKey: ['card-categories'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
      toast({
        title: isEdit ? t('cards.categories.updated') : t('cards.categories.created'),
        description: t('cards.categories.savedBody', { name: saved.name }),
        tone: 'success',
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: isEdit ? t('cards.categories.updateFailed') : t('cards.categories.createFailed'),
        description: (err as ApiError).message,
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width={720}>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('cards.categories.editTitle', { name: editing!.name })
              : t('cards.categories.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('cards.categories.editSubtitle')
              : t('cards.categories.createSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[1fr_220px]">
            {/* ------------------------------------------------------ form -- */}
            <div className="space-y-4">
              {/* Two pictures, because the app draws two: the glyph beside a
                  category row, and the cow on the large picker tile. */}
              <ArtworkField
                label={t('cards.categories.artwork')}
                help={t('cards.categories.imageConstraints')}
                slot={icon}
                current={currentIcon}
                removeLabel={t('cards.categories.removeArtwork')}
              />

              <ArtworkField
                label={t('cards.categories.cowArtwork')}
                help={t('cards.categories.cowConstraints')}
                slot={cow}
                current={currentCow}
                removeLabel={t('cards.categories.removeCow')}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="category-name" required>
                    {t('cards.categories.nameEn')}
                  </Label>
                  <Input
                    id="category-name"
                    value={name}
                    maxLength={60}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="category-name-es">{t('cards.categories.nameEs')}</Label>
                  <Input
                    id="category-name-es"
                    value={nameEs}
                    maxLength={60}
                    onChange={(e) => setNameEs(e.target.value)}
                  />
                  <FieldHelp>{t('cards.categories.nameEsHelp')}</FieldHelp>
                </div>
              </div>

              <div>
                <Label htmlFor="category-key" required={!isEdit}>
                  {t('cards.categories.key')}
                </Label>
                <Input
                  id="category-key"
                  value={key}
                  disabled={isEdit}
                  onChange={(e) => {
                    setKeyEdited(true);
                    setKey(e.target.value.trim());
                  }}
                  className="font-mono"
                />
                <FieldHelp>
                  {isEdit ? t('cards.categories.keyLocked') : t('cards.categories.keyHelp')}
                </FieldHelp>
                {!isEdit && key.length > 0 && !KEY_PATTERN.test(key) && (
                  <p className="mt-1 text-caption text-danger-500" role="alert">
                    {t('cards.categories.keyInvalid')}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="category-description">{t('cards.categories.description')}</Label>
                <Textarea
                  id="category-description"
                  rows={2}
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="category-color">{t('cards.categories.color')}</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={t('cards.categories.color')}
                      value={HEX_COLOR.test(color) ? color : '#7C3AED'}
                      onChange={(e) => setColor(e.target.value.toUpperCase())}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-neutral-300 bg-white p-1"
                    />
                    <Input
                      id="category-color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  {!colorOk && (
                    <p className="mt-1 text-caption text-danger-500" role="alert">
                      {t('cards.categories.colorInvalid')}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="category-emoji">{t('cards.categories.emoji')}</Label>
                  <Input
                    id="category-emoji"
                    value={emoji}
                    maxLength={8}
                    onChange={(e) => setEmoji(e.target.value)}
                  />
                  <FieldHelp>{t('cards.categories.emojiHelp')}</FieldHelp>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-neutral-200 p-3">
                <div className="min-w-0">
                  <Label htmlFor="category-active">{t('cards.categories.active')}</Label>
                  <FieldHelp>{t('cards.categories.activeHelp')}</FieldHelp>
                </div>
                <Switch id="category-active" checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>

            {/* --------------------------------------------------- preview -- */}
            <div>
              <Label>{t('cards.categories.preview')}</Label>
              <div className="mt-1 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <div
                  className="flex h-24 items-center justify-center rounded-md"
                  style={{ backgroundColor: HEX_COLOR.test(color) ? color : '#7C3AED' }}
                >
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt=""
                      className="max-h-16 max-w-16 object-contain"
                    />
                  ) : (
                    <span className="text-[32px] leading-none">{emoji || '🎁'}</span>
                  )}
                </div>
                {/* The tile the mobile app draws in its picker — the cow over
                    a pale wash of the category colour. */}
                <div className="mt-2 flex h-24 items-center justify-center rounded-md border border-neutral-200 bg-white">
                  {previewCow ? (
                    <img src={previewCow} alt="" className="max-h-20 max-w-20 object-contain" />
                  ) : (
                    <span className="text-caption text-neutral-400">
                      {t('cards.categories.noCow')}
                    </span>
                  )}
                </div>
                <p className="mt-3 truncate text-body font-medium text-neutral-900">
                  {name.trim() || t('cards.categories.untitled')}
                </p>
                {nameEs.trim() && (
                  <p className="truncate text-caption text-neutral-500">{nameEs.trim()}</p>
                )}
                <p className="mt-1 truncate font-mono text-caption text-neutral-400">
                  {key || '—'}
                </p>
              </div>
              <p className="mt-2 text-caption text-neutral-400">
                {t('cards.categories.previewNote')}
              </p>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={() => void save()}>
            {isEdit ? t('common.saveChanges') : t('cards.categories.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
