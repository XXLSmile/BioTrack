# M3 Development Info

## Deployment
- **Public IP / Domain**: `__PUBLIC_IP_OR_DOMAIN__`

## MVP Reference
- **Main Branch Commit Hash**: `__MVP_COMMIT_HASH__`

## Scope Alignment
- **External API integration** – The backend forwards recognition requests to the Zyla Labs Animal Recognition service, fulfilling the external-API requirement. Each photo submission returns a species label, confidence score, and top alternatives that the app shows to the user so they can decide which observation to catalog or share.
- **Live updates** – Catalog collaboration changes propagate instantly over Socket.IO so collaborators stay in sync. Users who are viewing the same catalog see new entries and edits within the same session without refreshing.
- **Push notifications** – Firebase Cloud Messaging delivers alerts when a user receives a friend request and when that request is accepted, so both people are notified even if the app is in the background.
- **Friends & recommendations** – The app supports searching, friending, and tailored suggestions based on shared species and proximity, covering the social networking scope item. Recommendations highlight mutual interests so users can grow their network beyond direct connections.

