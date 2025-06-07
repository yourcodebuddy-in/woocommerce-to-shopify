import { graphql } from "gql.tada";
import { currencyCode } from "../../data/shopify.js";
import { createShopifyClient } from "../../lib/shopify.js";
import type { WooCommerceOrder } from "../../types/woocommerce-order.js";
import { parseParcelPanelWooCommerceTrackingInfo } from "../parcelpanel.js";
import { getProductMapJson } from "../records.js";

function padPhoneNumber(phone: string) {
  // Remove any +91 prefix if present
  const cleanPhone = (phone.startsWith("+91") ? phone.slice(3) : phone).replace(/[^\d]/g, "");
  // If phone is not 10 digits, add a dummy number
  if (cleanPhone.length !== 10) {
    return "+911234567890";
  }
  return "+91" + cleanPhone;
}

function findShopifyProduct(id: number, sku: string) {
  return productMap.find((p) => p.wooCommerceProductId === id || p.sku === sku);
}

function findFinancialStatus(order: WooCommerceOrder) {
  if (order.status === "refunded") {
    return "REFUNDED";
  } else if (order.status === "failed" || order.status === "paymentfailed" || order.status === "cancelled") {
    return "VOIDED";
  } else if (order.status === "pending") {
    return "PENDING";
  } else if (!order.needs_payment || order.transaction_id) {
    return "PAID";
  } else {
    return "PENDING";
  }
}

function findOrderStatus(status: string) {
  if (status === "completed" || status === "out-for-delivery" || status === "in-transit") {
    return "shipped";
  }
  return status;
}

function findTransactionStatus(order: WooCommerceOrder) {
  if (order.status === "failed" || order.status === "paymentfailed" || order.status === "cancelled") {
    return "FAILURE";
  } else if (order.transaction_id || !order.needs_payment) {
    return "SUCCESS";
  } else {
    return "PENDING";
  }
}

const productMap = await getProductMapJson();

export async function createShopifyOrder(order: WooCommerceOrder) {
  const shopify = createShopifyClient();

  // Get tracking info
  const shipmentTrackingMeta = order.meta_data.find((meta) => meta.key === "_wc_shipment_tracking_items");
  const parcelPanelMeta = order.meta_data.find((meta) => meta.key === "_parcelpanel_shipping_numbers");
  const parcelPanelData = parseParcelPanelWooCommerceTrackingInfo(parcelPanelMeta?.value || "{}");
  const trackingNumber = shipmentTrackingMeta?.value?.[0]?.tracking_number || parcelPanelData?.[0]?.trackingNumber;
  const courier = shipmentTrackingMeta?.value?.[0]?.tracking_provider || parcelPanelData?.[0]?.courier;

  // Get Reward Points
  const rewardPointsGrantedMeta = order.meta_data.find((meta) => meta.key === "woocommerce_reward_points_granted");
  const rewardPointsRedeemedMeta = order.meta_data.find(
    (meta) => meta.key === "woocommerce_reward_points_points_redeemed"
  );
  const rewardPointsGranted = Math.abs(Number(rewardPointsGrantedMeta?.value || 0));
  const rewardPointsRedeemed = Math.abs(Number(rewardPointsRedeemedMeta?.value || 0));

  // Get Coupons
  const coupons = order.coupon_lines.map((coupon) => coupon.code);

  const createOrderResponse = await shopify.mutation(
    graphql(`
      mutation orderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
        orderCreate(order: $order, options: $options) {
          userErrors {
            field
            message
          }
          order {
            id
            email
          }
        }
      }
    `),
    {
      order: {
        billingAddress: {
          firstName: order.billing.first_name || "_",
          lastName: order.billing.last_name || "_",
          company: order.billing.company,
          phone: padPhoneNumber(order.billing.phone),
          address1: order.billing.address_1,
          address2: order.billing.address_2,
          city: order.billing.city,
          provinceCode: order.billing.state,
          countryCode: "IN",
          zip: order.billing.postcode,
        },
        shippingAddress: {
          firstName: order.shipping.first_name || "_",
          lastName: order.shipping.last_name || "_",
          company: order.shipping.company,
          phone: padPhoneNumber(order.billing.phone),
          address1: order.shipping.address_1,
          address2: order.shipping.address_2,
          city: order.shipping.city,
          provinceCode: order.shipping.state,
          countryCode: "IN",
          zip: order.shipping.postcode,
        },
        note: order.customer_note,
        buyerAcceptsMarketing: true,
        customAttributes: [
          {
            key: "WooCommerce Order ID",
            value: String(order.id),
          },
          {
            key: "WooCommerce Order Number",
            value: String(order.number),
          },
          {
            key: "Transaction ID",
            value: order.transaction_id || "N/A",
          },
          {
            key: "Tracking Number",
            value: trackingNumber || "N/A",
          },
          {
            key: "Courier",
            value: courier || "N/A",
          },
          {
            key: "Reward Points Granted",
            value: String(rewardPointsGranted),
          },
          {
            key: "Reward Points Redeemed",
            value: String(rewardPointsRedeemed),
          },
        ],
        customer: {
          toUpsert: {
            firstName: order.billing.first_name || "_",
            lastName: order.billing.last_name || "_",
            email: order.billing.email,
            // phone: padPhoneNumber(order.billing.phone),
            tags: ["woocommerce"],
          },
        },
        email: order.billing.email,
        phone: padPhoneNumber(order.billing.phone),
        financialStatus: findFinancialStatus(order),
        fulfillmentStatus: order.date_completed || trackingNumber ? "FULFILLED" : null,
        fulfillment:
          order.date_completed || trackingNumber
            ? {
                trackingCompany: courier,
                trackingNumber: trackingNumber,
                notifyCustomer: false,
                locationId: process.env.SHOPIFY_FULFILLMENT_LOCATION_ID,
                shipmentStatus: order.status === "delivered" ? "DELIVERED" : "CONFIRMED",
              }
            : null,
        lineItems: [
          ...order.line_items.map((item) => {
            const shopifyProduct = findShopifyProduct(item.id, item.sku);
            return {
              title: item.name,
              quantity: item.quantity || 1,
              priceSet: {
                shopMoney: {
                  amount: (Number(item.subtotal) / (item.quantity || 1)).toFixed(2),
                  currencyCode,
                },
              },
              sku: item.sku,
              productId: shopifyProduct?.shopifyProductId || null,
              variantId: shopifyProduct?.shopifyVariantId || null,
            };
          }),
          ...order.fee_lines
            .filter((fee) => !fee.amount.startsWith("-")) // Negative amount means discount
            .map((fee) => ({
              title: fee.name,
              quantity: 1,
              priceSet: {
                shopMoney: {
                  amount: fee.total,
                  currencyCode,
                },
              },
            })),
          ...(order.line_items.length === 0
            ? [
                {
                  title: "No Product Fallback",
                  quantity: 1,
                  priceSet: {
                    shopMoney: {
                      amount: order.total,
                      currencyCode,
                    },
                  },
                },
              ]
            : []),
        ],
        tags: [`status:${findOrderStatus(order.status)}`],
        transactions:
          parseFloat(order.total) > 0
            ? [
                {
                  gateway: order.payment_method || "Manual",
                  processedAt: order.date_paid || order.date_created,
                  amountSet: {
                    shopMoney: {
                      amount: order.total,
                      currencyCode,
                    },
                  },
                  status: findTransactionStatus(order),
                },
              ]
            : [],
        shippingLines: order.shipping_lines.map((shipping) => ({
          priceSet: {
            shopMoney: {
              amount: shipping.total,
              currencyCode,
            },
          },
          title: shipping.method_title,
        })),
        discountCode:
          coupons.length || rewardPointsRedeemed
            ? {
                itemFixedDiscountCode: {
                  code: coupons.length ? coupons.join("_") : "REWARD POINTS",
                  amountSet: {
                    shopMoney: {
                      amount: Number(order.discount_total || 0) + rewardPointsRedeemed,
                      currencyCode,
                    },
                  },
                },
              }
            : null,
        taxLines: order.tax_lines.map((tax) => ({
          rate: 0,
          title: tax.label,
          priceSet: {
            shopMoney: {
              amount: tax.tax_total,
              currencyCode,
            },
          },
        })),
        name: String(order.number),
        processedAt: new Date(new Date(order.date_created).getTime() - 4 * 60 * 60 * 1000).toISOString(),
        sourceName: "WooCommerce",
        sourceIdentifier: String(order.id),
      },
      options: {
        sendFulfillmentReceipt: false,
        inventoryBehaviour: "BYPASS",
        sendReceipt: false,
      },
    }
  );

  return createOrderResponse;
}
