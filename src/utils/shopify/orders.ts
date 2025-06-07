import { graphql } from "gql.tada";
import { createShopifyClient } from "../../lib/shopify";

const shopify = createShopifyClient();

export async function getShopifyOrders(after?: string) {
  const response = await shopify.query(
    graphql(`
      query Orders($first: Int!, $after: String) {
        orders(first: $first, after: $after, reverse: true) {
          edges {
            node {
              id
              name
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `),
    { first: 250, after }
  );

  if (response.error || !response.data) {
    throw new Error(response.error?.message ?? "Unknown error");
  }

  return response.data;
}

export async function deleteShopifyOrder(orderId: string) {
  const response = await shopify.mutation(
    graphql(`
      mutation OrderDelete($orderId: ID!) {
        orderDelete(orderId: $orderId) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }
    `),
    { orderId }
  );

  if (response.error || response.data?.orderDelete?.userErrors || !response.data?.orderDelete?.deletedId) {
    throw new Error(response.error?.message ?? response.data?.orderDelete?.userErrors?.[0]?.message ?? "Unknown error");
  }

  return response.data.orderDelete.deletedId;
}
