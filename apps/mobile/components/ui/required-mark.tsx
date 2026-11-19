import { Text as RNText } from "react-native";

/**
 * The small red star after a label the seller must fill. Put it inside the label's `Text` so it takes the same size
 * and typeface. Screen readers skip it: the label's `accessibilityLabel` says "required" instead (D-061).
 */
function RequiredMark() {
  return (
    <RNText className="text-error" accessibilityElementsHidden importantForAccessibility="no">
      {" *"}
    </RNText>
  );
}

export { RequiredMark };
