declare global {
  namespace NodeJS {
    interface ProcessEnv {
      WOOCOMMERCE_URL: string;
      WOOCOMMERCE_CONSUMER_KEY: string;
      WOOCOMMERCE_CONSUMER_SECRET: string;
      SHOPIFY_STORE_URL: string;
      SHOPIFY_ACCESS_TOKEN: string;
      SHOPIFY_PLAN: "basic" | "advanced" | "plus" | "enterprise";
      SHOPIFY_FULFILLMENT_LOCATION_ID: string;
      NODE_ENV: "development" | "production" | "test";
    }
  }
}

export {};
