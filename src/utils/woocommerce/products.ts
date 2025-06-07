import type { WooCommerceProduct } from "../../types/woocommerce-product";
import type { WooCommerceProductVariation } from "../../types/woocommerce-product-variation";
import { getWooCommerceProductVariation } from "./variations";

interface GetWooCommerceProductsParams {
  page: number;
  per_page: number;
  order: "asc" | "desc";
}

export async function getWooCommerceProducts({ page, per_page, order }: GetWooCommerceProductsParams): Promise<{
  data: (WooCommerceProduct & { variations: WooCommerceProductVariation[] })[];
  total: number;
  totalPages: number;
}> {
  const url = new URL(`${process.env.WOOCOMMERCE_STORE_URL}/wp-json/wc/v3/products`);
  url.searchParams.append("consumer_key", process.env.WOOCOMMERCE_CONSUMER_KEY!);
  url.searchParams.append("consumer_secret", process.env.WOOCOMMERCE_CONSUMER_SECRET!);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("per_page", per_page.toString());
  url.searchParams.append("order", order);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`);
  }

  const data = await response.json();
  const total = parseInt(response.headers.get("x-wp-total") ?? "0");
  const totalPages = parseInt(response.headers.get("x-wp-totalpages") ?? "0");

  const dataWithVariations = await Promise.all(
    data.map(async (product: WooCommerceProduct) => {
      const variations = await Promise.all(
        product.variations.map((variationId) => getWooCommerceProductVariation(product.id, variationId))
      );

      return {
        ...product,
        variations,
      };
    })
  );

  return {
    data: dataWithVariations,
    total,
    totalPages,
  };
}
