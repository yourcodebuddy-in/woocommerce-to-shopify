import type { FailedOrder, ProductMap, SuccessfulOrder } from "../types/records";

export async function getSuccessfulOrdersSet(): Promise<Set<number>> {
  try {
    const orders: SuccessfulOrder[] = await Bun.file("src/data/successful-orders.json").json();
    return new Set(orders.map((order) => order.wooCommerceOrderId));
  } catch {
    return new Set();
  }
}

export async function getFailedOrdersSet(): Promise<Set<number>> {
  try {
    const orders: FailedOrder[] = await Bun.file("src/data/failed-orders.json").json();
    return new Set(orders.map((order) => order.wooCommerceOrderId));
  } catch {
    return new Set();
  }
}

export async function getSuccessfulOrdersJson(): Promise<SuccessfulOrder[]> {
  try {
    return await Bun.file("src/data/successful-orders.json").json();
  } catch {
    return [];
  }
}

export async function getFailedOrdersJson(): Promise<FailedOrder[]> {
  try {
    return await Bun.file("src/data/failed-orders.json").json();
  } catch {
    return [];
  }
}

export async function saveProductMap(productMap: ProductMap[]) {
  await Bun.write("src/data/product-map.json", JSON.stringify(productMap));
}

export async function getProductMapJson(): Promise<ProductMap[]> {
  try {
    return await Bun.file("src/data/product-map.json").json();
  } catch {
    return [];
  }
}
