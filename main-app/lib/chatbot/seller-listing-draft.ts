export type SellerListingDraft = {
  name: string;
  price: number | null;
  category: string;
  photos: string[];
  stockQuantity: number | null;
};

export type SellerListingField = keyof SellerListingDraft;

export const SELLER_LISTING_FIELD_ORDER: SellerListingField[] = [
  'name',
  'price',
  'category',
  'photos',
  'stockQuantity',
];

export function createEmptySellerListingDraft(): SellerListingDraft {
  return {
    name: '',
    price: null,
    category: '',
    photos: [],
    stockQuantity: null,
  };
}

export function extractSellerListingDraft(
  message: string,
  currentDraft: SellerListingDraft | null,
): SellerListingDraft {
  const draft = currentDraft ?? createEmptySellerListingDraft();
  const normalized = message.toLowerCase();
  const nextDraft: SellerListingDraft = {
    ...draft,
    photos: [...draft.photos],
  };

  if (/\b(skip|later|not now)\b/i.test(message) && /\bphoto|photos|image|images\b/i.test(message)) {
    nextDraft.photos = nextDraft.photos.slice(0, 10);
  }

  const namedValue = (label: string) => {
    const match = message.match(
      new RegExp(`${label}\\s*[:=\\-]\\s*([^\\n\\r;]+)`, 'i'),
    );
    return match?.[1]?.trim() ?? '';
  };

  const nameMatch = message.match(/(?:product\s+)?name\s*[:=\-]\s*([^\n\r;]+)/i);
  if (nameMatch?.[1]?.trim()) {
    nextDraft.name = nameMatch[1].trim();
  } else if (!nextDraft.name) {
    const quoted = message.match(/(?:^|\s)["']([^"']{3,120})["']/);
    if (quoted?.[1]?.trim()) {
      nextDraft.name = quoted[1].trim();
    }
  }

  const categoryValue = namedValue('category');
  if (categoryValue) {
    nextDraft.category = categoryValue;
  }

  const priceMatch = message.match(
    /(?:price|cost|amount|tk|taka|bdt)\s*[:=\-]?\s*(?:bdt\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i,
  );
  if (priceMatch?.[1]) {
    const parsed = Number(priceMatch[1].replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) {
      nextDraft.price = parsed;
    }
  }

  const stockMatch = message.match(
    /(?:stock|inventory|quantity|qty)\s*[:=\-]?\s*(\d{1,6})/i,
  );
  if (stockMatch?.[1]) {
    const parsed = Number(stockMatch[1]);
    if (Number.isFinite(parsed) && parsed >= 0) {
      nextDraft.stockQuantity = parsed;
    }
  }

  const urlMatches = message.match(/https?:\/\/[^\s,)]+/gi);
  if (urlMatches?.length) {
    const unique = new Set(nextDraft.photos);
    urlMatches.forEach((url) => unique.add(url));
    nextDraft.photos = Array.from(unique).slice(0, 10);
  }

  if (!nextDraft.name && /^(?:a|an|the)\s+[a-z0-9]/i.test(message.trim())) {
    nextDraft.name = message.trim();
  }

  if (!nextDraft.category && normalized.includes('electronics')) {
    nextDraft.category = 'electronics';
  }

  return nextDraft;
}

export function getSellerListingMissingFields(draft: SellerListingDraft) {
  const missing: Array<SellerListingField> = [];

  if (!draft.name.trim()) missing.push('name');
  if (!draft.price || !Number.isFinite(draft.price)) missing.push('price');
  if (!draft.category.trim()) missing.push('category');
  if (!draft.photos.length) missing.push('photos');
  if (!draft.stockQuantity && draft.stockQuantity !== 0) missing.push('stockQuantity');

  return missing;
}

export function getSellerListingPrompt(draft: SellerListingDraft) {
  const missing = getSellerListingMissingFields(draft);

  if (missing.length === 0) {
    return 'Looks ready. Review the preview and tap Create listing when you are happy with it.';
  }

  const nextField = missing[0];

  switch (nextField) {
    case 'name':
      return 'What is the product name?';
    case 'price':
      return 'What price should I set?';
    case 'category':
      return 'Which category fits it best?';
    case 'photos':
      return 'Share one or more product photo URLs, or say skip if you want to add them later.';
    case 'stockQuantity':
      return 'How many units should we start with?';
    default:
      return 'Tell me a little more about the listing.';
  }
}

export function getSellerListingFieldSummary(draft: SellerListingDraft) {
  return [
    {
      field: 'name' as const,
      label: 'Name',
      value: draft.name.trim(),
      ready: Boolean(draft.name.trim()),
    },
    {
      field: 'price' as const,
      label: 'Price',
      value: typeof draft.price === 'number' && Number.isFinite(draft.price) ? draft.price : null,
      ready: typeof draft.price === 'number' && Number.isFinite(draft.price),
    },
    {
      field: 'category' as const,
      label: 'Category',
      value: draft.category.trim(),
      ready: Boolean(draft.category.trim()),
    },
    {
      field: 'photos' as const,
      label: 'Photos',
      value: draft.photos.length,
      ready: draft.photos.length > 0,
    },
    {
      field: 'stockQuantity' as const,
      label: 'Stock',
      value:
        typeof draft.stockQuantity === 'number' && Number.isFinite(draft.stockQuantity)
          ? draft.stockQuantity
          : null,
      ready:
        typeof draft.stockQuantity === 'number' && Number.isFinite(draft.stockQuantity),
    },
  ];
}

export function isSellerListingStartMessage(message: string) {
  return /\b(create|new|add|start|draft|build|make)\b.*\b(listing|product)\b|\b(listing|product)\b.*\b(create|new|add|start|draft|build|make)\b/i.test(
    message,
  );
}

export function isSellerListingCancelMessage(message: string) {
  return /\b(cancel|stop|clear|discard|reset)\b/i.test(message);
}

export function isSellerListingSubmitMessage(message: string) {
  return /\b(confirm|create|publish|save|submit|looks good|go ahead|finish)\b/i.test(message);
}

export function buildSellerListingIntentOutput(
  draft: SellerListingDraft,
  sellerId: string,
  source = 'seller-chat-listing-flow',
) {
  return {
    intent: 'SELLER_LISTING_CREATE',
    payload: {
      name: draft.name.trim(),
      price: Number(draft.price),
      category: draft.category.trim(),
      photos: draft.photos,
      stockQuantity: Number(draft.stockQuantity ?? 0),
    },
    metadata: {
      sellerId,
      source,
    },
  };
}
