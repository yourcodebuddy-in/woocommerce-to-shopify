# WooCommerce to Shopify Order Migration

This tool helps you migrate orders from WooCommerce to Shopify. It's built with TypeScript and Bun, and handles large numbers of orders efficiently.

**Important**: This tool only migrates orders. For products and categories, use the WordPress plugin mentioned below.

## What it does

- Migrates orders from WooCommerce to Shopify in batches
- Handles thousands of orders without hitting API limits
- Keeps track of what's been migrated so you can resume if something goes wrong
- Maps WooCommerce products to Shopify products so order line items work correctly
- Preserves customer info, tracking numbers, and order metadata
- Supports popular tracking and reward point plugins

## What you need

- Bun installed on your computer
- A WooCommerce store with API access
- A Shopify store with API access
- WordPress admin access to install a plugin

## Getting started

1. **Clone this repo and install dependencies**

   ```bash
   git clone https://github.com/yourcodebuddy-in/woocommerce-to-shopify.git
   cd woocommerce-to-shopify
   bun install
   ```

2. **Set up your environment**

   Copy `.env.example` to `.env` and fill in your details:

   ```bash
   cp .env.example .env
   ```

3. **Configure for your region (important!)**

   **Fork this repository first** to customize for your region. Then update:

   - **Currency**: Change `currencyCode` in `src/data/shopify.ts`
   - **Phone numbers**: Update `padPhoneNumber` function in `src/utils/shopify/create-shopify-order.ts` for your country's format (currently configured for Indian +91 prefix, 10 digits)
   - **Couriers**: Update `src/utils/identify-courier.ts` and `src/utils/parcelpanel.ts` with your country's courier patterns (currently configured for Indian providers like DTDC, India Post)

## How to migrate everything

### Step 1: Migrate products first (WordPress plugin)

Before migrating orders, you need to get your products into Shopify. Use the [W2S - Migrate WooCommerce to Shopify](https://wordpress.org/plugins/w2s-migrate-woo-to-shopify/) WordPress plugin for this.

Why use the plugin instead of this tool?

- It's designed specifically for products and categories
- Handles product variations, images, and metadata properly
- Much easier to use through the WordPress admin

**If you have less than 10,000 orders**, you can actually use the paid version of this plugin to migrate orders too. It might be simpler than using this tool.

**Get the paid version**: You can purchase the pro version from [Envato Market](https://1.envato.market/Z6NnGK) (affiliate link - helps support this project).

### Step 2: Create a product map

After your products are in Shopify, run this to create a mapping between your WooCommerce and Shopify products:

```bash
bun run src/app/products-map.ts
```

This creates a file that tells the order migration which Shopify product corresponds to each WooCommerce product. Without this, your order line items won't link to the right products.

### Step 3: Get location IDs for fulfillment

Before creating orders, you need to get your Shopify location IDs for order fulfillment:

```bash
bun run src/app/locations.ts
```

This will display your available Shopify locations with their IDs. Copy the location ID you want to use for fulfillment and add it to your `.env` file as `SHOPIFY_FULFILLMENT_LOCATION_ID`.

### Step 4: Migrate your orders

Now you can migrate orders:

```bash
bun run src/app/create-orders.ts
```

The tool will:

- Fetch orders from WooCommerce in batches
- Create corresponding orders in Shopify
- Handle rate limits automatically based on your Shopify plan
- Save progress so you can resume if interrupted

### Step 5: Handle any failures

If some orders fail (which happens), you can retry them:

1. Check `src/data/failed-orders.json` to see what failed
2. Remove any orders that actually succeeded from the failed list
3. Run: `bun run src/app/failed-check.ts`

### Step 6: Clean up (if needed)

If you messed up and need to start over:

```bash
bun run src/app/delete-orders.ts
```

**Warning**: This deletes ALL archived orders in Shopify. Only use this if you're sure.

## Configuration

You can adjust these settings in `src/app/create-orders.ts`:

- `ORDERS_PER_PAGE`: How many orders to fetch at once (default: 100)
- `PARALLEL_PAGE_REQUESTS`: How many pages to fetch simultaneously (default: 10)
- `ORDER_STATUS`: Which WooCommerce order status to migrate (default: "processing")

The tool automatically adjusts batch sizes based on your Shopify plan's API credits:

- Basic: 100 API credits = 10 orders per batch (each order costs 10 credits)
- Advanced: 200 API credits = 20 orders per batch
- Plus: 1,000 API credits = 100 orders per batch
- Enterprise: 10,000 API credits = 1,000 orders per batch

## Monitoring progress

The tool shows detailed progress in the console and saves tracking files:

- `src/data/successful-orders.json` - Orders that migrated successfully
- `src/data/failed-orders.json` - Orders that failed to migrate
- `src/data/product-map.json` - Product mapping between platforms

## Common issues

**Invalid customer data**: Customers may enter emojis in names/addresses or invalid emails, which Shopify rejects. You'll need to manually fix these orders in your WooCommerce data before retrying.

**Customer upsert conflicts**: When importing multiple orders in parallel, the same customer might be created simultaneously, causing one request to fail with "email/phone already assigned" errors. This is normal - just retry the failed orders and they'll work since the customer already exists.

**Invalid phone numbers**: Customers may enter invalid phone numbers. The tool is configured for Indian numbers (+91 prefix, 10 digits) and adds a dummy number (+911234567890) for invalid entries. Update the `padPhoneNumber` function in `src/utils/shopify/create-shopify-order.ts` for your country's phone format.

**Product mapping problems**: Make sure your products have the same names and SKUs in both platforms.

**Rate limit errors**: The tool should handle these automatically, but if you keep hitting limits, try reducing the batch size.

**API authentication errors**: Double-check your API credentials in the `.env` file.

## Project structure

```
src/
├── app/
│   ├── create-orders.ts          # Main order migration script
│   ├── products-map.ts    # Creates product mapping
│   ├── delete-orders.ts   # Deletes orders (use carefully)
│   └── failed-check.ts    # Retries failed orders
├── data/                  # JSON files for tracking progress
├── lib/                   # Shopify API client
├── types/                 # TypeScript definitions
└── utils/                 # Helper functions
```

## Important notes

- Always test on a development store first
- Back up your data before running migrations
- The tool preserves order metadata, customer info, and tracking numbers
- Orders are created with the same status as in WooCommerce
- Customers are automatically created in Shopify if they don't exist

## Supported plugins

**Tracking**: [Advanced Shipment Tracking](https://wordpress.org/plugins/woo-advanced-shipment-tracking/) and [ParcelPanel](https://wordpress.org/plugins/parcelpanel/) - automatically extracts tracking info from order metadata.

**Reward Points**: [WooCommerce Reward Points](https://envato.market/gOLK4O) (affiliate link) - migrates granted and redeemed points.

### Customization

**Other plugins**: To support new plugins, check how they store data in `order.meta_data` and modify `src/utils/shopify/create-shopify-order.ts`.

**Regional**: The tool is configured for Indian couriers. For other countries, update the courier mapping files in `src/utils/`.

## Battle-tested at scale

I've personally used this tool to migrate **400,000 orders** (4 lakh) for one of my clients. It handled the massive migration smoothly without any major issues.

## Why I open-sourced this

After successfully migrating such a large number of orders, I realized there's no reliable tool in the market for transferring this volume of orders from WooCommerce to Shopify. Most existing solutions either have order limits, are too expensive, or simply can't handle enterprise-scale migrations.

I'm open-sourcing this tool to help the community and give back to fellow developers and store owners who face the same challenges.

## Contributing

This project can definitely be improved! I encourage the community to:

- **Add new features** - Support for more plugins, better error handling, UI improvements
- **Fix bugs** - Report issues and submit fixes
- **Improve documentation** - Help make the setup process even clearer
- **Optimize performance** - Make it even faster and more efficient

Feel free to submit pull requests, open issues, or suggest improvements. Together we can make this the best WooCommerce to Shopify migration tool available.

This tool has proven itself with hundreds of thousands of orders - now let's make it even better for everyone.
