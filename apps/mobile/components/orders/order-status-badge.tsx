import type { OrderStatus } from "@vinty/shared";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LOOK, orderStatusKey } from "@/lib/order-status";

/** The status of an order in plain words, with its icon. */
export function OrderStatusBadge({ status, role }: { status: OrderStatus; role: "buyer" | "seller" }) {
  const { t } = useTranslation();
  const look = ORDER_STATUS_LOOK[status];
  return <Badge variant={look.variant} icon={look.icon} label={t(orderStatusKey(status, role))} />;
}
