import type { ProductMap } from "../types/records";
import { saveProductMap } from "../utils/records";
import { getShopifyProducts } from "../utils/shopify/products";
import { getWooCommerceProducts } from "../utils/woocommerce/products";

console.log("Starting product mapping process...");
const startTime = performance.now();

// Step 1: Fetch all WooCommerce products
console.log("Step 1: Fetching WooCommerce products...");
const allWooCommerceProducts = [];
let currentWooCommercePage = 1;
let totalWooCommercePages = 1;

while (currentWooCommercePage <= totalWooCommercePages) {
  console.log(`  Fetching WooCommerce products page ${currentWooCommercePage}/${totalWooCommercePages}`);
  const wooCommerceResponse = await getWooCommerceProducts({
    page: currentWooCommercePage,
    per_page: 100,
    order: "desc",
  });

  allWooCommerceProducts.push(...wooCommerceResponse.data);
  totalWooCommercePages = wooCommerceResponse.totalPages;
  currentWooCommercePage++;

  console.log(`  Total WooCommerce products fetched so far: ${allWooCommerceProducts.length}`);
}

console.log(`✓ Completed fetching ${allWooCommerceProducts.length} WooCommerce products`);

// Step 2: Fetch all Shopify products
console.log("Step 2: Fetching Shopify products...");
const allShopifyProducts = [];
let hasNextShopifyPage = true;
let shopifyEndCursor = undefined;
let shopifyPageCount = 0;

while (hasNextShopifyPage) {
  shopifyPageCount++;
  console.log(`  Fetching Shopify products page ${shopifyPageCount}`);

  const shopifyResponse = await getShopifyProducts(shopifyEndCursor);
  allShopifyProducts.push(...shopifyResponse.products);
  hasNextShopifyPage = shopifyResponse.hasNextPage;
  shopifyEndCursor = shopifyResponse.endCursor;

  console.log(`  Fetched ${shopifyResponse.products.length} products from page ${shopifyPageCount}`);
  console.log(`  Total Shopify products fetched so far: ${allShopifyProducts.length}`);
}

console.log(`✓ Completed fetching ${allShopifyProducts.length} Shopify products`);

// Step 3: Create product mappings
console.log("Step 3: Creating product mappings...");
const productMappings: ProductMap[] = [];
let mappedProductsCount = 0;
let unmappedProductsCount = 0;

// Process each WooCommerce product to find matching Shopify product
for (const wooCommerceProduct of allWooCommerceProducts) {
  console.log(`  Processing WooCommerce product: "${wooCommerceProduct.name}" (ID: ${wooCommerceProduct.id})`);

  // Find matching Shopify product by title
  const matchingShopifyProduct = allShopifyProducts.find(
    (shopifyProduct) => shopifyProduct.title === wooCommerceProduct.name
  );

  if (!matchingShopifyProduct) {
    console.log(`    ⚠️  No matching Shopify product found for "${wooCommerceProduct.name}"`);
    unmappedProductsCount++;
    continue;
  }

  console.log(
    `    ✓ Found matching Shopify product: "${matchingShopifyProduct.title}" (ID: ${matchingShopifyProduct.id})`
  );

  // Handle simple products (no variations)
  if (wooCommerceProduct.type === "simple") {
    console.log(`    Processing simple product with SKU: ${wooCommerceProduct.sku}`);

    const matchingShopifyVariant = matchingShopifyProduct.variants.nodes.find(
      (variant) => variant.sku === wooCommerceProduct.sku
    );

    productMappings.push({
      title: wooCommerceProduct.name,
      sku: wooCommerceProduct.sku ?? "",
      wooCommerceProductId: wooCommerceProduct.id,
      wooCommerceVariationId: null,
      shopifyProductId: matchingShopifyProduct.id,
      shopifyVariantId: matchingShopifyVariant?.id,
    });

    mappedProductsCount++;
    console.log(`    ✓ Mapped simple product (SKU: ${wooCommerceProduct.sku})`);
  }
  // Handle variable products (with variations)
  else if (wooCommerceProduct.type === "variable") {
    console.log(`    Processing variable product with ${wooCommerceProduct.variations.length} variations`);

    for (const wooCommerceVariation of wooCommerceProduct.variations) {
      console.log(`      Processing variation with SKU: ${wooCommerceVariation.sku}`);

      const matchingShopifyVariant = matchingShopifyProduct.variants.nodes.find(
        (variant) => variant.sku === wooCommerceVariation.sku
      );

      productMappings.push({
        title: wooCommerceProduct.name,
        sku: wooCommerceVariation.sku ?? "",
        wooCommerceProductId: wooCommerceProduct.id,
        wooCommerceVariationId: wooCommerceVariation.id,
        shopifyProductId: matchingShopifyProduct.id,
        shopifyVariantId: matchingShopifyVariant?.id,
      });

      mappedProductsCount++;
      console.log(`      ✓ Mapped variation (SKU: ${wooCommerceVariation.sku})`);
    }
  }
}

// Step 4: Save product mappings to file
console.log("Step 4: Saving product mappings...");
await saveProductMap(productMappings);

// Step 5: Display summary
const endTime = performance.now();
const executionTime = ((endTime - startTime) / 1000).toFixed(2);

console.log("\n=== Product Mapping Summary ===");
console.log(`✓ Total WooCommerce products processed: ${allWooCommerceProducts.length}`);
console.log(`✓ Total Shopify products fetched: ${allShopifyProducts.length}`);
console.log(`✓ Successfully mapped products/variations: ${mappedProductsCount}`);
console.log(`⚠️  Unmapped WooCommerce products: ${unmappedProductsCount}`);
console.log(`✓ Total product mappings saved: ${productMappings.length}`);
console.log(`✓ Execution time: ${executionTime} seconds`);
console.log(`✓ Product mappings saved to: src/data/product-map.json`);
