export type SellerTool = {
  name: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
};

export class SellerIntentToolFactory {
  getToolByName(
    name: string,
  ):
    | { success: true; value: SellerTool }
    | { success: false; error: { code: string; message: string } } {
    switch (name) {
      case 'seller_sales_summary':
        return { success: true, value: { name: 'seller_sales_summary' } };
      case 'seller_listing_create':
        return { success: true, value: { name: 'seller_listing_create' } };
      default:
        return {
          success: false,
          error: { code: 'TOOL_NOT_FOUND', message: `Tool not found: ${name}` },
        };
    }
  }
}
