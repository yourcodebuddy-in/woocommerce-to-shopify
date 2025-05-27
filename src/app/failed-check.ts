import { getFailedOrdersJson, getSuccessfulOrdersJson } from "../utils/records";

const allFailedOrders = await getFailedOrdersJson();
const allSuccessfulOrders = await getSuccessfulOrdersJson();

// Remove duplicate failed orders by wooCommerceOrderId
const deduplicatedFailedOrders = allFailedOrders.filter(
  (order, index, array) => index === array.findIndex((o) => o.wooCommerceOrderId === order.wooCommerceOrderId)
);

// Create a set of successful order IDs for efficient lookup
const successfulOrderIdsSet = new Set(allSuccessfulOrders.map((order) => order.wooCommerceOrderId));

// Remove orders that were eventually successful from the failed orders list
const actuallyFailedOrders = deduplicatedFailedOrders.filter(
  (order) => !successfulOrderIdsSet.has(order.wooCommerceOrderId)
);

await Bun.write("src/data/failed-orders.json", JSON.stringify(actuallyFailedOrders, null, 2));

console.log(`Total failed orders (with duplicates): ${allFailedOrders.length}`);
console.log(`Total successful orders: ${allSuccessfulOrders.length}`);
console.log(`Deduplicated failed orders: ${deduplicatedFailedOrders.length}`);
console.log(`Actually failed orders (after removing successful): ${actuallyFailedOrders.length}`);
