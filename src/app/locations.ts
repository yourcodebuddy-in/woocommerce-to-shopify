import { graphql } from "gql.tada";
import { createShopifyClient } from "../lib/shopify";

const shopify = createShopifyClient();

const response = await shopify.query(
  graphql(`
    query {
      locations(first: 5) {
        edges {
          node {
            id
            name
            address {
              formatted
            }
          }
        }
      }
    }
  `),
  {}
);

const locations = response.data?.locations?.edges?.map((edge) => edge?.node);
console.log(locations);
