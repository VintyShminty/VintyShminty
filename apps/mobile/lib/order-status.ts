import type { OrderStatus } from "@vinty/shared";
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

type BadgeVariant = "accent" | "success" | "warning" | "error" | "neutral";

/** Look of the status pill. Never colour alone: every status has its own icon. */
export const ORDER_STATUS_LOOK: Record<OrderStatus, { icon: LucideIcon; variant: BadgeVariant }> = {
  pending_payment: { icon: Clock, variant: "warning" },
  paid: { icon: Wallet, variant: "accent" },
  shipped: { icon: Truck, variant: "accent" },
  delivered: { icon: PackageCheck, variant: "accent" },
  completed: { icon: Check, variant: "success" },
  cancelled: { icon: XCircle, variant: "error" },
  disputed: { icon: AlertTriangle, variant: "warning" },
  refunded: { icon: Undo2, variant: "neutral" },
};

/** Translation key of the plain words for a status, for this side of the order. */
export const orderStatusKey = (status: OrderStatus, role: "buyer" | "seller") =>
  `orders.status.${status}.${role}`;
