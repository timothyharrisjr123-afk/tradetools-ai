# Unavailable-owner recovery

Support-mediated custody recovery. This is not a product screen and not an Admin promotion.

Use it only when the custody Owner cannot authenticate and the business has been verified outside the app. `recover_company_custody_v1` is granted to `service_role` only. Anon and signed-in members cannot execute it.

The call requires:

- the company
- an active member of that company who will become Owner
- the role the current Owner will hold afterward: Admin, Sales, Production Lead, or Field
- a reason of at least 8 characters
- an idempotency key

The change is one transaction: the current Owner is demoted, the target becomes the only Owner, the custody pointer moves, and one `support_custody_recovered` audit row is written. Owner-only grants are removed from the former Owner. A repeated call with the same key returns the recorded result and does not move custody again.

Do not run this against production without an explicit approved case. Do not record secrets in the reason.
