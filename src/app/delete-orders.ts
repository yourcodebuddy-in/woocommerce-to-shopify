import { tryCatch } from "../lib/try-catch";
import { deleteShopifyOrder, getShopifyOrders } from "../utils/shopify/orders";

let totalOrdersDeleted = 0;
let totalOrdersFailedToDelete = 0;

let cursor: string | undefined;
let currentBatch = 1;
const ORDERS_PER_BATCH = 20;

while (true) {
  const ordersResponse = await getShopifyOrders(cursor);
  const orderEdges = ordersResponse?.orders.edges;

  // Break if no orders found
  if (!orderEdges?.length) {
    break;
  }

  console.log(`\nBatch ${currentBatch}: Processing ${orderEdges.length} orders...`);

  // Process orders in smaller batches to avoid rate limits
  for (let i = 0; i < orderEdges.length; i += ORDERS_PER_BATCH) {
    const orderBatch = orderEdges.slice(i, i + ORDERS_PER_BATCH);
    const deletionPromises = orderBatch.map(async (orderEdge) => {
      const { id, name } = orderEdge.node;
      const { error } = await tryCatch(deleteShopifyOrder(id));

      if (error) {
        console.error(`Error deleting order ${name} (${id}):`, error);
        totalOrdersFailedToDelete++;
      } else {
        totalOrdersDeleted++;
        console.log(`Successfully deleted order ${name} (${id})`);
      }
    });

    await Promise.allSettled(deletionPromises);
  }

  // Break if no more pages available
  if (!ordersResponse?.orders.pageInfo.hasNextPage) {
    break;
  }

  cursor = ordersResponse.orders.pageInfo.endCursor ?? undefined;
  currentBatch++;
}

console.log(`\nDeletion Summary:`);
console.log(`Total orders deleted: ${totalOrdersDeleted}`);
console.log(`Total orders failed to delete: ${totalOrdersFailedToDelete}`);
