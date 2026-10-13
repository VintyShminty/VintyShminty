import { View } from "react-native";
import { Text } from "@/components/ui/text";
import type { CheckoutAddress } from "@/lib/order-flow-queries";

/** An address written out on lines: name, street, city and postcode, phone. */
function AddressLines({ address }: { address: CheckoutAddress }) {
  return (
    <View className="gap-px">
      <Text weight={600}>{address.fullName}</Text>
      <Text variant="bodySmall" className="text-text-2">
        {[address.line1, address.line2].filter(Boolean).join(", ")}
      </Text>
      <Text variant="bodySmall" className="text-text-2">
        {address.postcode} {address.city}
      </Text>
      {address.phone ? (
        <Text variant="bodySmall" className="text-text-2">
          {address.phone}
        </Text>
      ) : null}
    </View>
  );
}

export { AddressLines };
