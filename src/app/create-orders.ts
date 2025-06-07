import { shopifyPlanRateLimits } from "../data/shopify.js";
import type { FailedOrder, SuccessfulOrder } from "../types/records.js";
import { getFailedOrdersJson, getSuccessfulOrdersJson, getSuccessfulOrdersSet } from "../utils/records.js";
import { createShopifyOrder } from "../utils/shopify/create-shopify-order.js";
import { getWooCommerceOrders } from "../utils/woocommerce/orders.js";

console.log("🚀 Starting WooCommerce to Shopify order migration process...");
console.log("📂 Loading existing failed and successful orders...");

const existingFailedOrders = await getFailedOrdersJson();
const existingSuccessfulOrders = await getSuccessfulOrdersJson();

console.log(`📊 Found ${existingFailedOrders.length} existing failed orders`);
console.log(`📊 Found ${existingSuccessfulOrders.length} existing successful orders`);

async function saveFailedOrdersToFile(failedOrders: FailedOrder[]) {
  console.log(`💾 Saving ${failedOrders.length} failed orders to file...`);
  existingFailedOrders.push(...failedOrders);
  await Bun.write("src/data/failed-orders.json", JSON.stringify(existingFailedOrders, null, 2));
  console.log(`✅ Successfully saved failed orders to file`);
}

async function saveSuccessfulOrdersToFile(successfulOrders: SuccessfulOrder[]) {
  console.log(`💾 Saving ${successfulOrders.length} successful orders to file...`);
  existingSuccessfulOrders.push(...successfulOrders);
  await Bun.write("src/data/successful-orders.json", JSON.stringify(existingSuccessfulOrders, null, 2));
  console.log(`✅ Successfully saved successful orders to file`);
}

const migrationStartTime = performance.now();

// Get already processed orders to avoid duplicates
console.log("🔍 Building set of already processed orders...");
let processedOrdersSet = await getSuccessfulOrdersSet();
console.log(`📋 Found ${processedOrdersSet.size} already processed orders - these will be skipped`);

// Migration configuration
const ORDERS_PER_PAGE = 100;
const PLAN_RATE_LIMIT =
  shopifyPlanRateLimits[process.env.SHOPIFY_PLAN as keyof typeof shopifyPlanRateLimits] ?? shopifyPlanRateLimits.basic;
const BATCH_SIZE = PLAN_RATE_LIMIT / 10; // Each request cost 10 API credits
const PARALLEL_PAGE_REQUESTS = 10;
const ORDER_STATUS = "completed";

// Migration state tracking
let totalOrdersCreated = 0;
let totalOrdersFailed = 0;
let currentPageNumber = 1; // Start from page 1, can be adjusted for resuming
let hasMoreOrdersToProcess = true;
const specificOrderIds: number[] = []; // Can be used to process specific failed orders

console.log("⚙️ Migration configuration:");
console.log(`   - Orders per page: ${ORDERS_PER_PAGE}`);
console.log(`   - Batch size: ${BATCH_SIZE}`);
console.log(`   - Parallel page requests: ${PARALLEL_PAGE_REQUESTS}`);
console.log(`   - Order status filter: ${ORDER_STATUS}`);
console.log(`   - Starting from page: ${currentPageNumber}`);

while (hasMoreOrdersToProcess) {
  const pagesFetchStartTime = performance.now();
  console.log(
    `\n📥 Fetching ${PARALLEL_PAGE_REQUESTS} page(s) starting from page ${currentPageNumber} from WooCommerce...`
  );

  // Create array of page numbers to fetch in parallel
  const pageNumbersToFetch = Array.from({ length: PARALLEL_PAGE_REQUESTS }, (_, index) => currentPageNumber + index);
  console.log(`📄 Pages to fetch: ${pageNumbersToFetch.join(", ")}`);

  // Fetch multiple pages in parallel for better performance
  const wooCommerceOrderArrays = await Promise.all(
    pageNumbersToFetch.map((pageNumber) => {
      console.log(`🔄 Fetching page ${pageNumber}...`);
      return getWooCommerceOrders({
        page: pageNumber,
        per_page: ORDERS_PER_PAGE,
        status: ORDER_STATUS,
        order: "desc",
        include: specificOrderIds,
      });
    })
  );

  // Flatten the arrays of orders from all pages
  const allFetchedOrders = wooCommerceOrderArrays.flat();

  if (allFetchedOrders.length === 0) {
    console.log("🏁 No more orders found - migration complete");
    hasMoreOrdersToProcess = false;
    break;
  }

  const pagesFetchEndTime = performance.now();
  const fetchDuration = ((pagesFetchEndTime - pagesFetchStartTime) / 1000).toFixed(2);
  console.log(
    `✅ Successfully fetched ${allFetchedOrders.length} orders from pages ${currentPageNumber}-${
      currentPageNumber + PARALLEL_PAGE_REQUESTS - 1
    } (${fetchDuration}s)`
  );

  // Filter out already processed orders to avoid duplicates
  const ordersToProcess = allFetchedOrders.filter((order) => !processedOrdersSet.has(order.id));
  const skippedOrdersCount = allFetchedOrders.length - ordersToProcess.length;

  console.log(`🔍 Filtering results:`);
  console.log(`   - Total fetched: ${allFetchedOrders.length}`);
  console.log(`   - Already processed (skipped): ${skippedOrdersCount}`);
  console.log(`   - New orders to process: ${ordersToProcess.length}`);

  if (ordersToProcess.length === 0) {
    console.log("⏭️ All orders in this batch were already processed - moving to next pages");
    currentPageNumber += PARALLEL_PAGE_REQUESTS;
    continue;
  }

  // Process orders in smaller batches to manage memory and rate limits
  const totalBatches = Math.ceil(ordersToProcess.length / BATCH_SIZE);
  console.log(
    `📦 Processing ${ordersToProcess.length} orders in ${totalBatches} batch(es) of ${BATCH_SIZE} orders each`
  );

  for (let batchIndex = 0; batchIndex < ordersToProcess.length; batchIndex += BATCH_SIZE) {
    const batchStartTime = performance.now();
    const currentBatch = ordersToProcess.slice(batchIndex, batchIndex + BATCH_SIZE);
    const batchNumber = Math.floor(batchIndex / BATCH_SIZE) + 1;

    console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (${currentBatch.length} orders)...`);

    const batchFailedOrders: FailedOrder[] = [];
    const batchSuccessfulOrders: SuccessfulOrder[] = [];

    // Process all orders in the current batch concurrently
    const batchResults = await Promise.allSettled(
      currentBatch.map(async (wooCommerceOrder) => {
        const orderProcessingStartTime = performance.now();
        console.log(`   🔄 Creating Shopify order for WooCommerce order #${wooCommerceOrder.id}...`);

        try {
          const shopifyOrderResponse = await createShopifyOrder(wooCommerceOrder);

          // Check for errors in the Shopify response
          if (shopifyOrderResponse.error || shopifyOrderResponse.data?.orderCreate?.userErrors?.length) {
            console.error(`   ❌ Failed to create Shopify order for WooCommerce order #${wooCommerceOrder.id}`);
            console.error("   📋 Error details:", {
              error: shopifyOrderResponse.error,
              userErrors: shopifyOrderResponse.data?.orderCreate?.userErrors,
            });

            batchFailedOrders.push({
              wooCommerceOrderId: wooCommerceOrder.id,
              error: shopifyOrderResponse.error,
              userErrors: shopifyOrderResponse.data?.orderCreate?.userErrors,
              timestamp: new Date().toISOString(),
            });

            return { success: false, wooCommerceOrderId: wooCommerceOrder.id };
          }

          // Success case
          const shopifyOrderId = shopifyOrderResponse.data?.orderCreate?.order?.id ?? "";
          batchSuccessfulOrders.push({
            wooCommerceOrderId: wooCommerceOrder.id,
            shopifyOrderId: shopifyOrderId,
            timestamp: new Date().toISOString(),
          });

          const orderProcessingEndTime = performance.now();
          const orderDuration = ((orderProcessingEndTime - orderProcessingStartTime) / 1000).toFixed(2);
          console.log(
            `   ✅ Successfully created Shopify order for WooCommerce order #${wooCommerceOrder.id} (${orderDuration}s)`
          );

          return { success: true, wooCommerceOrderId: wooCommerceOrder.id, shopifyOrderId };
        } catch (error) {
          console.error(
            `   ❌ Exception while creating Shopify order for WooCommerce order #${wooCommerceOrder.id}:`,
            error
          );

          batchFailedOrders.push({
            wooCommerceOrderId: wooCommerceOrder.id,
            error: error,
            timestamp: new Date().toISOString(),
          });

          return { success: false, wooCommerceOrderId: wooCommerceOrder.id };
        }
      })
    );

    // Update counters
    const batchSuccessCount = batchSuccessfulOrders.length;
    const batchFailedCount = batchFailedOrders.length;
    totalOrdersCreated += batchSuccessCount;
    totalOrdersFailed += batchFailedCount;

    // Save batch results to files
    console.log(`💾 Saving batch results...`);
    if (batchFailedOrders.length > 0) {
      await saveFailedOrdersToFile(batchFailedOrders);
    }
    if (batchSuccessfulOrders.length > 0) {
      await saveSuccessfulOrdersToFile(batchSuccessfulOrders);
    }

    // Update the processed orders set to avoid reprocessing
    processedOrdersSet = new Set([
      ...processedOrdersSet,
      ...batchSuccessfulOrders.map((order) => order.wooCommerceOrderId),
    ]);

    const batchEndTime = performance.now();
    const batchDuration = ((batchEndTime - batchStartTime) / 1000).toFixed(2);
    console.log(`📊 Batch ${batchNumber}/${totalBatches} completed:`);
    console.log(`   - Successful: ${batchSuccessCount}`);
    console.log(`   - Failed: ${batchFailedCount}`);
    console.log(`   - Duration: ${batchDuration}s`);
    console.log(`📈 Running totals: ${totalOrdersCreated} successful, ${totalOrdersFailed} failed`);
  }

  currentPageNumber += PARALLEL_PAGE_REQUESTS;
}

const migrationEndTime = performance.now();
const totalMigrationTime = ((migrationEndTime - migrationStartTime) / 1000).toFixed(2);

console.log("\n🎉 Migration Summary:");
console.log("=".repeat(50));
console.log(`✅ Successfully created: ${totalOrdersCreated} Shopify orders`);
console.log(`❌ Failed to create: ${totalOrdersFailed} Shopify orders`);
console.log(`⏱️ Total migration time: ${totalMigrationTime}s`);
console.log(
  `📊 Success rate: ${
    totalOrdersCreated + totalOrdersFailed > 0
      ? ((totalOrdersCreated / (totalOrdersCreated + totalOrdersFailed)) * 100).toFixed(1)
      : 0
  }%`
);
console.log("🏁 WooCommerce to Shopify order migration process completed");
