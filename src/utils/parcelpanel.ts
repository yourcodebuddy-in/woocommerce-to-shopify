export function getParcelPanelCourierName(courier: string): string | null {
  switch (courier) {
    case "dtdc":
      return "DTDC";
    case "shree-tirupati":
      return "Shree Tirupati Courier";
    case "shreemaruticourier":
      return "Shree Maruti Courier";
    case "india-post":
      return "India Post";
    case "shreeanjanicourier":
      return "Shree Anjani Courier";
    case "smartr":
      return "Smartr Logistics";
    case "amazon-in":
      return "Amazon India";
    case "delhivery":
      return "Delhivery";
    default:
      return null;
  }
}

interface ParcelPanelWooCommerceTrackingValue {
  [key: string]: {
    order_id: number;
    courier_code: string;
    tracking_number: string;
    fulfilled_at: number;
    items: string; // comma separated list of products ("Saffron Crocus Bulb(1Pc) x5, Coco Peat (500gm, Buy 1 Get 1 free) x1)
  };
}

export function parseParcelPanelWooCommerceTrackingInfo(value: string) {
  const trackingInfo = JSON.parse(value) as ParcelPanelWooCommerceTrackingValue;
  const trackingNumbers = Object.keys(trackingInfo);
  return trackingNumbers.map((number) => ({
    orderId: trackingInfo[number].order_id,
    trackingNumber: number,
    trackingLink: `${process.env.WOOCOMMERCE_STORE_URL}/track/`,
    courier: getParcelPanelCourierName(trackingInfo[number].courier_code),
    fulfilledAt: trackingInfo[number].fulfilled_at,
    items: trackingInfo[number].items.split(","),
  }));
}
