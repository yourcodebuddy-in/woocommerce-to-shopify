import { graphql } from "gql.tada";
import { createShopifyClient } from "../../lib/shopify";

const shopify = createShopifyClient();

export async function getShopifyProducts(after?: string | null) {
  const response = await shopify.query(
    graphql(`
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          nodes {
            id
            title
            variants(first: 50) {
              nodes {
                id
                sku
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    `),
    {
      first: 250,
      after,
    }
  );

  if (response.error || !response.data?.products.nodes) {
    throw new Error(response.error?.message ?? "Unknown error");
  }

  return {
    products: response.data.products.nodes,
    hasNextPage: response.data.products.pageInfo.hasNextPage,
    endCursor: response.data.products.pageInfo.endCursor,
  };
}
