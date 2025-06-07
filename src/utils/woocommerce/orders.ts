import type { WooCommerceOrder } from "../../types/woocommerce-order";

interface GetWooCommerceOrdersParams {
  page: number;
  per_page: number;
  status: string;
  order: "asc" | "desc";
  include?: number[];
}

export async function getWooCommerceOrders({
  page,
  per_page,
  status,
  order,
  include = [],
}: GetWooCommerceOrdersParams): Promise<WooCommerceOrder[]> {
  const url = new URL(`${process.env.WOOCOMMERCE_STORE_URL}/wp-json/wc/v3/orders`);
  url.searchParams.set("consumer_key", process.env.WOOCOMMERCE_CONSUMER_KEY!);
  url.searchParams.set("consumer_secret", process.env.WOOCOMMERCE_CONSUMER_SECRET!);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(per_page));
  url.searchParams.set("order", order);
  url.searchParams.set("status", status);
  include.map((id) => url.searchParams.append("include[]", String(id)));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch WooCommerce orders: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid response from WooCommerce");
  }

  return data;
}
