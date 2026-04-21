'use client';

import Image from 'next/image';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { GripVertical, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  ACCEPTED_PRODUCT_IMAGE_MIME_TYPES,
  MAX_PRODUCT_IMAGE_COUNT,
  validateProductImageFile,
} from '@/lib/types/product-image.types';

type ExistingImageItem = {
  id: string;
  kind: 'existing';
  url: string;
};

type NewImageItem = {
  id: string;
  kind: 'new';
  previewUrl: string;
  file: File;
};

type ImageItem = ExistingImageItem | NewImageItem;

type ImageOrderRef = { kind: 'existing'; value: string } | { kind: 'new'; value: string };

type MultiImageUploadValue = {
  imageOrder: ImageOrderRef[];
  newUploads: Array<{
    token: string;
    file: File;
  }>;
};

type MultiImageUploadProps = {
  id?: string;
  label?: string;
  initialImageUrls?: string[];
  disabled?: boolean;
  submitting?: boolean;
  onChange: (value: MultiImageUploadValue) => void;
};

function createExistingImageItem(url: string): ExistingImageItem {
  return {
    id: `existing-${crypto.randomUUID()}`,
    kind: 'existing',
    url,
  };
}

function createNewImageItem(file: File): NewImageItem {
  return {
    id: `new-${crypto.randomUUID()}`,
    kind: 'new',
    previewUrl: URL.createObjectURL(file),
    file,
  };
}

function toImageOrder(item: ImageItem): ImageOrderRef {
  if (item.kind === 'existing') {
    return {
      kind: 'existing',
      value: item.url,
    };
  }

  return {
    kind: 'new',
    value: item.id,
  };
}

function toNewUploads(item: ImageItem): { token: string; file: File } | null {
  if (item.kind !== 'new') {
    return null;
  }

  return {
    token: item.id,
    file: item.file,
  };
}

export function MultiImageUpload({
  id = 'product_images',
  label = 'Product Images',
  initialImageUrls = [],
  disabled = false,
  submitting = false,
  onChange,
}: MultiImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ImageItem[]>(() =>
    initialImageUrls.map(createExistingImageItem),
  );

  const uploadingProgress = useMemo(() => {
    if (!submitting) {
      return 0;
    }

    return items.some((item) => item.kind === 'new') ? 70 : 100;
  }, [submitting, items]);

  const emitChange = (nextItems: ImageItem[]) => {
    const imageOrder = nextItems.map(toImageOrder);
    const newUploads = nextItems
      .map(toNewUploads)
      .filter((entry): entry is NonNullable<typeof entry> => !!entry);

    onChange({ imageOrder, newUploads });
  };

  const updateItems = (updater: (current: ImageItem[]) => ImageItem[]) => {
    setItems((current) => {
      const next = updater(current);
      emitChange(next);
      return next;
    });
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const incoming = Array.from(fileList);

    setError(null);

    updateItems((current) => {
      const remainingSlots = MAX_PRODUCT_IMAGE_COUNT - current.length;

      if (remainingSlots <= 0) {
        setError(`You can upload up to ${MAX_PRODUCT_IMAGE_COUNT} images per product.`);
        return current;
      }

      const selected = incoming.slice(0, remainingSlots);

      for (const file of selected) {
        const validation = validateProductImageFile(file);

        if (!validation.valid) {
          setError(validation.error || 'Invalid image file.');
          return current;
        }
      }

      const nextNewItems = selected.map(createNewImageItem);

      return [...current, ...nextNewItems];
    });
  };

  const moveItem = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return;
    }

    updateItems((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);

      return next;
    });
  };

  const removeItem = (idToRemove: string) => {
    updateItems((current) => {
      const removed = current.find((item) => item.id === idToRemove);

      if (removed?.kind === 'new') {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return current.filter((item) => item.id !== idToRemove);
    });
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(event.target.files);
    event.currentTarget.value = '';
  };

  return (
    <div className="grid gap-3">
      <Label htmlFor={id}>{label}</Label>

      <div
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (disabled || submitting) {
            return;
          }

          const droppedFiles = event.dataTransfer.files;
          if (droppedFiles && droppedFiles.length > 0) {
            handleFilesSelected(droppedFiles);
            return;
          }

          const sourceId = event.dataTransfer.getData('text/plain');
          const target = (event.target as HTMLElement).closest('[data-image-id]');
          const targetId = target?.getAttribute('data-image-id');

          if (sourceId && targetId) {
            moveItem(sourceId, targetId);
          }
        }}
        className={cn(
          'rounded-lg border border-dashed bg-muted/20 p-4',
          disabled || submitting ? 'opacity-70' : 'border-input',
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="hidden"
          accept={ACCEPTED_PRODUCT_IMAGE_MIME_TYPES.join(',')}
          multiple
          onChange={handleFileInput}
          disabled={disabled || submitting}
        />

        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Upload up to {MAX_PRODUCT_IMAGE_COUNT} images. Drag images to reorder. First image is
            primary.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || submitting || items.length >= MAX_PRODUCT_IMAGE_COUNT}
          >
            <Upload className="mr-2 h-4 w-4" />
            Add Images
          </Button>
        </div>

        {submitting ? (
          <div className="mb-3 space-y-1">
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${uploadingProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Uploading images and saving product...</p>
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No images selected yet.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => {
              const imageSrc = item.kind === 'existing' ? item.url : item.previewUrl;

              return (
                <li
                  key={item.id}
                  data-image-id={item.id}
                  draggable={!disabled && !submitting}
                  onDragStart={(event) => {
                    setDraggingId(item.id);
                    event.dataTransfer.setData('text/plain', item.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = event.dataTransfer.getData('text/plain');
                    moveItem(sourceId, item.id);
                  }}
                  className={cn(
                    'group relative overflow-hidden rounded-md border bg-background',
                    draggingId === item.id ? 'opacity-50' : 'opacity-100',
                  )}
                >
                  <div className="relative aspect-video w-full bg-muted">
                    <Image
                      src={imageSrc}
                      alt={`Product image ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized={imageSrc.startsWith('blob:')}
                    />
                    <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                      {index === 0 ? 'Primary' : `#${index + 1}`}
                    </div>
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded bg-black/60 p-1 text-white"
                      onClick={() => removeItem(item.id)}
                      disabled={disabled || submitting}
                      aria-label={`Remove image ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between border-t px-2 py-1 text-xs text-muted-foreground">
                    <span>{item.kind === 'existing' ? 'Existing' : 'New'}</span>
                    <span className="inline-flex items-center gap-1">
                      <GripVertical className="h-3 w-3" />
                      Drag
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
