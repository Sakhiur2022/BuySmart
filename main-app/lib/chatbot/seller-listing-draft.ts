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
  validCategories: string[] = [],
): SellerListingDraft {
  const draft = currentDraft ?? createEmptySellerListingDraft();
  const normalized = message.toLowerCase().trim();

  const nextDraft: SellerListingDraft = {
    ...draft,
    photos: [...draft.photos],
  };

  // Name
  if (!nextDraft.name) {
    const nameMatch = message.match(/(?:product\s+)?name\s*[:=\-]\s*([^\n\r;]+)/i);
    if (nameMatch?.[1]) nextDraft.name = nameMatch[1].trim();
    else if (message.length > 2 && message.length < 100) {
      nextDraft.name = message.trim();
    }
  }

  // Price
  const priceMatch = message.match(
    /(?:price|cost|set|for)?\s*[:=\-]?\s*(?:bdt|tk|taka)?\s*(\d{1,8}(?:[.,]\d{1,2})?)/i,
  );
  if (priceMatch?.[1]) {
    const num = Number(priceMatch[1].replace(/,/g, ''));
    if (Number.isFinite(num) && num > 0) nextDraft.price = num;
  }

  // Category (Dynamic from Supabase)
  // CATEGORY - Support numbered choice + direct name
  if (!nextDraft.category) {
    const catMatch = message.match(/(?:category|type)\s*[:=\-]\s*([^\n\r;]+)/i);
    if (catMatch?.[1]) {
      const input = catMatch[1].trim().toLowerCase();
      const matched = validCategories.find(
        (cat) => cat.toLowerCase() === input || input.includes(cat.toLowerCase()),
      );
      if (matched) nextDraft.category = matched;
    }

    // Handle "1", "2", "3" replies
    const numberMatch = message.match(/^\s*(1|2|3)\b/);
    if (numberMatch && validCategories.length > 0) {
      const index = parseInt(numberMatch[1]) - 1;
      if (validCategories[index]) {
        nextDraft.category = validCategories[index];
      }
    }

    // Fallback scan
    if (!nextDraft.category) {
      for (const cat of validCategories) {
        if (normalized.includes(cat.toLowerCase())) {
          nextDraft.category = cat;
          break;
        }
      }
    }
  }

  // Stock
  const stockMatch = message.match(/(?:stock|qty|quantity)\s*[:=\-]?\s*(\d+)/i);
  if (stockMatch?.[1]) nextDraft.stockQuantity = Number(stockMatch[1]);

  // Photos
  const urls = message.match(/https?:\/\/[^\s,)]+/gi);
  if (urls) {
    const unique = new Set(nextDraft.photos);
    urls.forEach((u) => unique.add(u));
    nextDraft.photos = Array.from(unique).slice(0, 10);
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

export function getSellerListingPrompt(draft: SellerListingDraft, validCategories: string[] = []) {
  const missing = getSellerListingMissingFields(draft);

  if (missing.length === 0) {
    return 'Looks ready! Review the preview and tap Create listing.';
  }

  const nextField = missing[0];

  switch (nextField) {
    case 'name':
      return 'What is the product name?';
    case 'price':
      return 'What price should I set? (e.g. 15000 or 25k)';
    case 'category':
      // Intelligent top 3 suggestion based on name
      const productName = draft.name.toLowerCase();
      let suggested: string[] = [];

      // Simple keyword-based scoring
      const scores: Array<{ cat: string; score: number }> = validCategories.map((cat: string) => {
        const catLower = cat.toLowerCase();
        let score = 0;

        if (productName.includes(catLower)) score += 10;
        if (catLower.includes('phone') && productName.includes('phone')) score += 5;
        if (catLower.includes('laptop') && productName.includes('laptop')) score += 5;
        if (
          (catLower.includes('head') || catLower.includes('ear')) &&
          (productName.includes('head') || productName.includes('ear'))
        )
          score += 5;

        return { cat, score };
      });

      // Sort by score and take top 3
      suggested = scores
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((item: { cat: string }) => item.cat);

      return (
        `Based on "${draft.name}", I suggest these categories:\n\n` +
        `1. ${suggested[0] || 'Phone'}\n` +
        `2. ${suggested[1] || 'Laptop'}\n` +
        `3. ${suggested[2] || 'Headphone'}\n\n` +
        `Reply with the number (1, 2, 3) or type the full category name.`
      );
    case 'photos':
      return 'Share product photo URLs, or type "skip" if you want to add them later.';
    case 'stockQuantity':
      return 'How many units in stock?';
    default:
      return 'Tell me more about the product.';
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
      ready: typeof draft.stockQuantity === 'number' && Number.isFinite(draft.stockQuantity),
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
