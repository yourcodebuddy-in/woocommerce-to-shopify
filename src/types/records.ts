export interface FailedOrder {
  wooCommerceOrderId: number;
  error: any;
  userErrors?: any[];
  timestamp: string;
}

export interface SuccessfulOrder {
  wooCommerceOrderId: number;
  shopifyOrderId: string;
  timestamp: string;
}

export interface ProductMap {
  title: string;
  sku: string;
  wooCommerceProductId: number;
  wooCommerceVariationId: number | null | undefined;
  shopifyProductId: string;
  shopifyVariantId: string | null | undefined;
}
