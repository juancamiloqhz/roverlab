# Triage labels

Map the engineering skills' canonical triage roles to these strings.

| Canonical role | Tracker string | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate the issue |
| `needs-info` | `needs-info` | Waiting on the reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified and ready for an agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

When a skill mentions a canonical role, use its tracker string. The issue-tracker document defines the field used to store it.

Edit the Tracker string column if the repository's vocabulary changes.
