import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { FeedbackHighlight } from '@/lib/types/insights.types';

type SellerFeedbackHighlightIdentityProps = {
  highlight: FeedbackHighlight;
};

function getInitials(name: string | null): string {
  const safeName = name?.trim();

  if (!safeName) {
    return 'B';
  }

  const parts = safeName.split(/\s+/).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');

  return initials || 'B';
}

export function SellerFeedbackHighlightIdentity({
  highlight,
}: SellerFeedbackHighlightIdentityProps) {
  const buyerName = highlight.buyerName ?? 'Anonymous buyer';
  const productName = highlight.productName ?? 'Product unavailable';

  return (
    <div className="flex items-center gap-2 rounded-md border border-muted bg-muted/20 px-2.5 py-2 transition-colors duration-200 hover:bg-muted/35">
      <Avatar className="h-8 w-8">
        {highlight.buyerAvatarUrl ? (
          <AvatarImage src={highlight.buyerAvatarUrl} alt={`Buyer avatar for ${buyerName}`} />
        ) : null}
        <AvatarFallback aria-label={`Buyer avatar for ${buyerName}`}>
          {getInitials(highlight.buyerName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium text-foreground transition-colors duration-200 hover:text-primary">
          {buyerName}
        </p>
        <p
          className="truncate text-xs text-muted-foreground"
          title={productName}
          aria-label={`Product name ${productName}`}
        >
          {productName}
        </p>
      </div>
    </div>
  );
}
