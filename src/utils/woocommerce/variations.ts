import type { WooCommerceProductVariation } from "../../types/woocommerce-product-variation";

export async function getWooCommerceProductVariation(
  productId: number,
  variationId: number
): Promise<WooCommerceProductVariation> {
  const url = new URL(
    `${process.env.WOOCOMMERCE_STORE_URL}/wp-json/wc/v3/products/${productId}/variations/${variationId}`
  );
  url.searchParams.append("consumer_key", process.env.WOOCOMMERCE_CONSUMER_KEY!);
  url.searchParams.append("consumer_secret", process.env.WOOCOMMERCE_CONSUMER_SECRET!);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch product variation: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}
