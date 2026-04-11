export interface BuyerProductListItem {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  short_description: string | null;
}

export interface BuyerProductPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface BuyerProductListFilters {
  page: number;
  pageSize: number;
  priceMin?: number;
  priceMax?: number;
  categoryId?: number;
  query?: string;
}

export interface BuyerProductListResult {
  products: BuyerProductListItem[];
  pagination: BuyerProductPagination;
}

export interface BuyerProductQueryParams {
  page?: number;
  pageSize?: number;
  priceMin?: number;
  priceMax?: number;
  categoryId?: number;
  q?: string;
  search?: string;
}
