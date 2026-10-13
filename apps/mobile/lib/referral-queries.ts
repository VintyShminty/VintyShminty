import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { type RedeemReferralInput, referralSummarySchema } from "@vinty/shared";
import { api } from "@/lib/api";

// Invite friends (Milestone 9). Key: ["referral"] holds the code, the friends and the vouchers in one call.

export const referralQuery = () =>
  queryOptions({
    queryKey: ["referral"],
    queryFn: () => api("/v1/me/referral", { schema: referralSummarySchema }),
  });

/** Enters a friend's code. The server says which rule was broken (see describeRedeemError). */
export function useRedeemReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RedeemReferralInput) => api("/v1/referrals/redeem", { method: "POST", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["referral"] }),
  });
}
