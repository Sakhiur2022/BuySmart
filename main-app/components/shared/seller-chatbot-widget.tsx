import ChatbotWidget from '@/components/shared/chatbot-widget';
import { createProductAction } from '@/lib/actions/products';
import type { Category } from '@/lib/models/category.model';

type SellerChatbotWidgetProps = {
  sellerUserId?: string | null;
  categories?: Category[];
};

export default function SellerChatbotWidget({ sellerUserId, categories }: SellerChatbotWidgetProps) {
  return (
    <ChatbotWidget
      chatbotRole="seller"
      initialSellerId={sellerUserId}
      initialSellerCategories={categories}
      sellerCreateProductAction={createProductAction}
    />
  );
}
