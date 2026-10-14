import { ORDER_STATUS_VARIANT, type OrderStatus } from "@vinty/shared";
import {
  AlertTriangle,
  Check,
  Clock,
  type LucideIcon,
  PackageCheck,
  Truck,
  Undo2,
  Wallet,
  XCircle,
} from "lucide-react-native";

/** Look of the status pill. Never colour alone: every status has its own icon. */
export const ORDER_STATUS_LOOK: Record<
  OrderStatus,
  { icon: LucideIcon; variant: (typeof ORDER_STATUS_VARIANT)[OrderStatus] }
> = {
  pending_payment: { icon: Clock, variant: ORDER_STATUS_VARIANT.pending_payment },
  paid: { icon: Wallet, variant: ORDER_STATUS_VARIANT.paid },
  shipped: { icon: Truck, variant: ORDER_STATUS_VARIANT.shipped },
  delivered: { icon: PackageCheck, variant: ORDER_STATUS_VARIANT.delivered },
  completed: { icon: Check, variant: ORDER_STATUS_VARIANT.completed },
  cancelled: { icon: XCircle, variant: ORDER_STATUS_VARIANT.cancelled },
  disputed: { icon: AlertTriangle, variant: ORDER_STATUS_VARIANT.disputed },
  refunded: { icon: Undo2, variant: ORDER_STATUS_VARIANT.refunded },
};

// The words for a status (orderStatusKey) live in the shared package, the website uses them too.
export { orderStatusKey } from "@vinty/shared";
