# 02 — OLD TO NEW MAPPING

| Legacy surface | New local surface | Checkpoint status | UI/flow change |
|---|---|---|---|
| landing | React LandingPage | Ported | No intentional redesign |
| loginStudent | React StudentLoginPage | UI ported | Auth intentionally disconnected |
| registerStudent | React StudentRegisterPage | UI ported | Auth intentionally disconnected |
| loginGV | React TeacherLoginPage | UI ported | Auth intentionally disconnected |
| index | Reserved route | Pending | None approved |
| detail | Reserved route | Pending | None approved |
| add | Reserved route | Pending | None approved |
| editPost | Reserved route | Pending | None approved |
| myPosts | Reserved route | Pending | None approved |
| myDetail | Reserved route | Pending | None approved |
| profile | Reserved route | Pending | None approved |
| admin | Reserved route | Pending | None approved |

## Checkpoint 1B update

| Legacy surface | Legacy source | Local React state | Backend status | UI/flow change |
|---|---|---|---|---|
| Marketplace/index | `index.html` | Implemented | Mock/local only | No intentional redesign |
| Student header | `utilsHeader.html` + `stylesStudent.html` | Implemented | Mock/local identity | No intentional redesign |
| Market stats | `index.html` + `stylesMarket.html` | Implemented | Local sample aggregation | No |
| Search/filter/sort | `index.html` + `Posts.gs` | Implemented | Local array | No |
| Ranking/AI switch | `index.html` + `Posts.gs` | Implemented as local ordering | Backend later | No |
| Favorites | `Interactions.gs` | UI toggle only | Backend later | No |
| Pagination | `index.html` + `Posts.gs` | Implemented | Local array | No |

## Checkpoint 1F update

| Legacy surface | Legacy source | Local React state | Backend status | UI/flow change |
|---|---|---|---|---|
| My Posts | `myPosts.html` + owner summary APIs | Implemented | In-memory local store | No intentional redesign |
| Owner Detail | `myDetail.html` + `getMyPostDetailBundle` | Implemented | Controlled local bundle | No intentional redesign |
| Owner Edit | `editPost.html` + `updatePostByOwner` | Implemented | Local form/store only | No intentional redesign |
| Edit → re-moderation | `updatePostByOwner` | Implemented: status → `Chờ duyệt`, rejection cleared, hidden=false | Backend later | No |
| Contact handled | `markContactHandled` | Local toggle + timeline update | Backend later | No |
| Owner duplicate | `duplicatePostByOwner` | Shared local store + edit route | Backend later | No |
| Owner hide/show | `toggleOwnerPostHidden` | Shared local store | Backend later | No |
| Owner complete/withdraw | `markPostDoneSecure` / `withdrawPostSecure` | Shared local store | Backend later | No |
