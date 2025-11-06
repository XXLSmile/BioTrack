# M3 Development Info

## Deployment
- **Public IP / Domain**: http://4.206.208.211:80

## MVP Reference
- **Main Branch Commit Hash**: 1df5e51

## Scope Alignment
- **External API integration** – The backend forwards recognition requests to the Zyla Labs Animal Recognition service, fulfilling the external-API requirement. Each photo submission returns a species label, confidence score, and top alternatives that the app shows to the user so they can decide which observation to catalog or share. Google’s Geocoding API turns captured latitude/longitude into human-readable city/province labels, and the Android client embeds Google Maps tiles to display observation locations and navigation routes.
- **Live updates** – Catalog collaboration changes propagate instantly over Socket.IO so collaborators stay in sync. Users who are viewing the same catalog see new entries and edits within the same session without refreshing.
- **Push notifications** – Firebase Cloud Messaging delivers alerts when a user receives a friend request and when that request is accepted, so both people are notified even if the app is in the background.
- **Friends & recommendations** – The app supports searching, friending, and tailored suggestions based on shared species and proximity, covering the social networking scope item. Recommendations highlight mutual interests so users can grow their network beyond direct connections.
