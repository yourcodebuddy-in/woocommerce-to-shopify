import { Client, cacheExchange, fetchExchange } from "@urql/core";

export function createShopifyClient() {
  const requestUrl = new URL(process.env.SHOPIFY_STORE_URL!);
  requestUrl.pathname = "/admin/api/2025-04/graphql.json";

  return new Client({
    url: String(requestUrl),
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => {
      return {
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN!,
        },
      };
    },
  });
}
