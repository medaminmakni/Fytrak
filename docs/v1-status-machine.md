# V1 Role + Assignment Status Machine

## Trainee-Coach assignment status

- `unassigned` — trainee has no active coach
- `pending` — trainee request sent; waiting coach decision
- `assigned` — active coach linked
- `rejected` — last request rejected
- `expired` — pending request timed out (7 days)

## Coach verification status

- `not_submitted`
- `under_review`
- `verified`
- `rejected`

## Key rules

- One active coach per trainee.
- Unverified coaches visible in discovery.
- Verified coaches ranked first in discovery/search.
- Verification docs visible to admin only.
