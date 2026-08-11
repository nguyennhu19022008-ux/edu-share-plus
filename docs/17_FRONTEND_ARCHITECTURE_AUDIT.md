# EDU SHARE+ — Frontend Architecture Audit (Checkpoint 2A)

**Status:** Phase 1 baseline đã PASS và được đóng băng.  
**Scope:** kiểm toán kiến trúc frontend của chính baseline 1I trước khi refactor.  
**Rule:** không redesign, không thay đổi flow, không nối Supabase/database/storage, không thêm Product Verification/Dispute vào UI cũ trong checkpoint này.

---

## 1. Executive conclusion

Baseline hiện tại **đủ tốt để làm mốc tương thích UI/UX**, nhưng **chưa nên nối trực tiếp PostgreSQL/Supabase**. Lý do không phải giao diện sai, mà vì data access, state ownership, route loading và CSS vẫn mang tính checkpoint/prototype.

Quyết định kiến trúc cho Phase 2:

1. **Giữ nguyên URL legacy `?page=...` và toàn bộ hành vi điều hướng nhìn thấy bởi người dùng.**
2. **Không thay router chỉ vì “hiện đại hơn”.** Trước mắt nâng cấp router adapter hiện tại thành route registry + lazy loading để giữ tương thích tuyệt đối.
3. **Tạo data-access boundary trước khi có Supabase.** UI không được gọi trực tiếp mock store sau Phase 2D.
4. **Tách shared domain primitives nhưng không ép tất cả màn hình dùng một kiểu dữ liệu khổng lồ.** Marketplace/Admin/My Posts vẫn có view model riêng.
5. **Tách page lớn thành component/hook theo feature, không over-componentize.**
6. **Giữ CSS legacy về mặt thị giác; chỉ cô lập và chia tải theo route sau khi có visual regression gate.**
7. Phase 2 phải kết thúc với cùng 12 route, cùng UI/UX/flow, nhưng code đủ sạch để Phase 3 thiết kế ERD và Phase 4–6 thay mock adapter bằng backend thật.

---

## 2. Baseline inventory

### 2.1 Source size

Static audit của checkpoint 1I:

- TypeScript/TSX: **29 files / ~3,610 lines / ~204 KB source**.
- Page TSX: **13 files / ~2,542 lines / ~149 KB source**.
- CSS: **8 files / ~3,476 lines / ~163 KB source**.
- Legacy routes: **12/12 implemented**.
- Missing relative imports ở audit 1I: **0**.
- Invalid navigation targets ở audit 1I: **0**.

Các page lớn nhất:

| Page | Lines | Nhận xét |
|---|---:|---|
| `AdminPage.tsx` | ~451 | Quá nhiều trách nhiệm: filter, draft moderation, modal, metrics, charts, controls |
| `MyPostsPage.tsx` | ~331 | Dashboard + filter/sort + card + owner actions cùng file |
| `MarketplacePage.tsx` | ~305 | Hero/filter/smart strip/card/pagination cùng file |
| `ProfilePage.tsx` | ~273 | Profile, privacy, media, password, notifications cùng page |
| `MyDetailPage.tsx` | ~268 | Detail, metrics, contacts, comments, timeline, owner actions |
| `DetailPage.tsx` | ~231 | Post detail + favorite + contact + comments + similar posts |

Các file này chưa phải “App.tsx vài nghìn dòng”, nhưng đã vượt ngưỡng hợp lý để nối backend mà không tăng coupling.

### 2.2 Current directory shape

```text
src/
  app/
    App.tsx
    legacyRouter.ts
  components/
    student/StudentHeader.tsx
  features/
    admin/
    marketplace/
    my-posts/
    profile/
  pages/
  styles/
  main.tsx
```

Điểm tốt: Phase 1 đã bắt đầu có feature folders và shared header. Điểm còn thiếu: service/repository boundary, app providers, shared domain primitives, feature components/hooks và route-level code splitting.

---

## 3. Route architecture audit

### Hiện tại

`App.tsx` import eager tất cả page rồi `switch(route.page)`.

Ưu điểm:

- rất dễ giữ đúng URL GAS cũ;
- `routeKey` đã sửa đúng lỗi `detail?id=A → detail?id=B`;
- History API/back-forward hoạt động;
- không cần dependency router mới.

Hạn chế:

- tất cả page JS được kéo vào initial dependency graph;
- `key={routeKey}` remount toàn page trên mỗi query-route change;
- route metadata và component mapping nằm trong switch thủ công;
- chưa có lazy boundary/error boundary theo route.

### Quyết định

**Không chuyển sang pathname mới và không đổi UX URL trong Phase 2.**

Target 2B:

```text
legacy URL (?page=index&id=...)
          ↓
legacyRouter adapter
          ↓
routeRegistry
          ↓
React.lazy(page module)
          ↓
route fallback/error boundary
```

Cách này đạt code splitting mà không phá bookmark/link/flow cũ.

---

## 4. Bundle/loading architecture finding

### Finding FA-01 — Eager page imports

Severity: **High for performance architecture**.

`App.tsx` hiện import tất cả 12 page modules ngay từ đầu. Admin dashboard, Profile, My Posts và các mock datasets vì vậy nằm trong cùng graph dù người dùng chỉ mở Landing.

**Fix phase:** 2B.

**Target:** route-level dynamic import bằng `React.lazy`/`import()`.

**Compatibility gate:** Landing, auth, marketplace và admin vẫn mở bằng cùng URL/copy/layout.

### Finding FA-02 — All legacy CSS imported globally

Severity: **High for maintainability, Medium for current runtime**.

`main.tsx` hiện import cả 8 stylesheet cho mọi route. Static selector scan tìm thấy khoảng **100 selector definitions xuất hiện ở nhiều stylesheet**, trong đó các selector generic như `.card`, `.container`, `.btn`, `.post-card`, `.owner-post-card`, `.metric-card`, `.admin-content` có cross-file collision/cascade dependency.

Điều này giải thích vì sao **không được “dọn CSS” một lần lớn**: cascade hiện tại là một phần của visual baseline.

**Safe strategy:**

1. giữ `legacy-base.css` + compatibility overrides global;
2. ghi inventory dependency CSS theo route;
3. chuyển từng route group sang CSS import riêng **một nhóm một lần**;
4. sau mỗi nhóm phải chạy desktop + mobile visual smoke test;
5. chỉ sau khi ổn mới cân nhắc scope/module hóa selector mới.

**Không đổi class name hàng loạt trong 2B.**

---

## 5. State ownership audit

### 5.1 Current stores

Phase 1 sử dụng module-level mutable in-memory stores:

- `localOwnerStore`
- `localOwnerDetailStore`
- `localProfileStore`
- `localAdminStore`

Đây là lựa chọn đúng cho Phase 1 vì giúp test flow xuyên route mà không giả backend.

Nhưng chúng có ba giới hạn:

1. không có subscription model chung;
2. component tự lấy snapshot rồi giữ thêm local React state;
3. UI đang biết store implementation cụ thể.

### 5.2 Ownership matrix đề xuất

| State | Owner sau Phase 2 | Persistence hiện tại | Backend tương lai |
|---|---|---|---|
| Route/query | `app/router` | browser history | client only |
| Session identity | `features/auth` interface | local mock adapter | Supabase Auth |
| Profile/privacy | `features/profile` repository | in-memory | `profiles` + RLS |
| Favorites | `features/favorites` repository | in-memory | `favorites` |
| Marketplace filters/sort/page | page hook | component state | client only/query params nếu cần |
| Post read models | posts/marketplace repository | mock | PostgreSQL view/query |
| Owner posts | posts repository | in-memory | `posts` |
| Owner timeline/contact | activity/contact repository | in-memory | audit/contact tables |
| Comments/replies | comments repository | local page sample | `comments` |
| Moderation drafts/actions | moderation repository | in-memory admin store | moderation tables/RPC |
| Notifications | notifications repository | in-memory | `notifications` |
| Upload draft/preview | post form hook | Object URL | Storage phase |

### Quy tắc

- Local UI state như input/filter/modal **không đưa vào global store**.
- Server-derived data sau này sẽ do query/repository layer quản lý.
- Không tạo một Context khổng lồ chứa toàn bộ app state.

---

## 6. Data-access audit

### Finding FA-03 — UI imports concrete mock/store modules

Severity: **Critical before backend integration**.

Ví dụ hiện tại:

```text
MarketplacePage → mockPosts + localProfileStore
DetailPage      → mockPosts + localProfileStore
MyPostsPage     → localOwnerStore + localOwnerDetailStore
ProfilePage     → localProfileStore
AdminPage       → localAdminStore
```

Nếu nối Supabase trực tiếp vào các page này, frontend sẽ bị khóa vào provider và Phase 3–6 trở thành một cuộc rewrite thứ hai.

### Target boundary

```text
Page / Feature Component
          ↓
Feature hook/use-case
          ↓
Repository interface
          ↓
Mock adapter (Phase 2)
          ↓ later swap
Supabase adapter (Phase 4–6)
```

Ví dụ target:

```ts
interface PostRepository {
  listMarketPosts(query: MarketQuery): Promise<PageResult<MarketPostView>>;
  getPostDetail(id: string): Promise<PostDetailView | null>;
  createPost(input: CreatePostInput): Promise<PostRef>;
  updatePost(id: string, input: UpdatePostInput): Promise<PostRef>;
}
```

Phase 2D vẫn dùng mock adapter; **không có network call**.

---

## 7. Domain/type audit

### Finding FA-04 — Post concept bị lặp ở nhiều type

Hiện có:

- `MarketPost`
- `MyPost`
- `AdminPost`

Chúng cùng chứa `id/title/description/tradeType/category/className/price/date/dateTs` nhưng khác field theo màn hình.

Sai lầm cần tránh: gộp tất cả thành một `Post` 40–50 field rồi mọi page phụ thuộc toàn bộ.

### Target

Tạo primitives chung:

```text
TradeType
PostStatus
PostSource
CommentStatus
CategoryKey/string
PostId
```

Sau đó giữ view model riêng:

```text
MarketPostView
OwnerPostView
AdminPostView
PostDetailView
```

Các adapter/map functions chịu trách nhiệm chuyển domain record → view model.

Điều này phù hợp với database normalized về sau và giảm việc UI biết quá nhiều column.

---

## 8. Duplicate logic audit

Static scan phát hiện các helper/constants lặp ở nhiều page:

- `normalize` — Marketplace, My Posts, Admin
- `formatMoney` — Marketplace, My Posts, Detail, My Detail
- `statusLabel` — My Posts, My Detail, Admin
- `doneButtonText` — My Posts, My Detail
- `getPostId` — Edit Post, My Detail
- `CATEGORIES` — Marketplace, Add, Edit
- `TRADE_TYPES` — Add, Edit
- `PAGE_SIZE` — Marketplace, Admin (khác ngữ cảnh nên không nhất thiết gộp)

### Target

Tách có chọn lọc:

```text
src/shared/lib/text/normalizeVietnamese.ts
src/shared/lib/format/formatVnd.ts
src/features/posts/model/constants.ts
src/features/posts/model/status.ts
src/app/query.ts
```

Không tạo `utils.ts` khổng lồ.

---

## 9. Page decomposition audit

### Marketplace

Target ownership:

```text
MarketplacePage
 ├─ MarketplaceHero
 ├─ MarketplaceStats
 ├─ MarketplaceFilters
 ├─ SmartRecommendationStrip
 ├─ PostGrid
 │   └─ MarketPostCard
 └─ Pagination
```

State/filter logic → `useMarketplaceController` hoặc các hook nhỏ.

### My Posts

```text
MyPostsPage
 ├─ OwnerPostSummary
 ├─ OwnerPostTabs
 ├─ OwnerPostToolbar
 └─ OwnerPostList
     └─ OwnerPostCard
```

Action mutation → owner-post use-cases/repository.

### My Detail

```text
MyDetailPage
 ├─ OwnerPostHeader
 ├─ OwnerPostMetrics
 ├─ ContactLogSection
 ├─ OwnerCommentsSection
 └─ OwnerTimelineSection
```

### Profile

```text
ProfilePage
 ├─ ProfileIdentityCard
 ├─ ReputationCard
 ├─ ActivityStats
 ├─ PrivacySettings
 ├─ SavedPosts
 ├─ ProfileMedia
 ├─ PasswordPanel
 └─ NotificationList
```

### Admin

Admin là ưu tiên refactor cao nhất:

```text
AdminPage
 ├─ AdminTopbar
 ├─ AdminSummary
 ├─ AdminAnalytics
 ├─ ModerationToolbar
 ├─ ModerationTable
 └─ ModerationModal
```

Chart rendering riêng trong `features/admin/components/charts/`.

**Rule:** page giữ composition + route params; business/state mutation không nằm rải trong JSX.

---

## 10. Header/layout audit

`StudentHeader` đã là shared component tốt, nhưng hiện vẫn đọc concrete local profile store trực tiếp.

Target:

```text
StudentShell
 ├─ StudentHeader
 └─ route content
```

Header nhận một `session/profile/notification summary` từ hook/provider interface thay vì import local store.

Không ép Landing/Auth/Admin dùng StudentShell vì baseline cũ có shell riêng.

Admin có thể có `AdminShell` sau khi tách 2C.

---

## 11. Body class lifecycle finding

Nhiều page tự chạy:

```ts
document.body.className = '...';
return () => { document.body.className = ''; };
```

Điều này hoạt động trong baseline nhưng phân tán side effect.

Target 2B/2C: route metadata khai báo body class, App shell áp dụng một chỗ.

Lợi ích:

- tránh stale class khi route/error/lazy boundary;
- giảm useEffect lặp;
- dễ kiểm thử route-to-layout mapping.

---

## 12. Form architecture finding

Add/Edit hiện lặp:

- category list;
- trade type list;
- sale-price enable/disable;
- image object URL lifecycle;
- validation/submitting lock.

Target 2C:

```text
PostFormFields
usePostFormMediaPreview
postFormSchema/validation functions
```

Không thêm form library ở thời điểm này nếu native React logic vẫn đủ rõ; tránh tăng bundle/dependency khi chưa có nhu cầu thực.

---

## 13. Performance opportunities for Phase 2

Không tuyên bố performance improvement cho tới khi đo, nhưng architecture audit xác định các cơ hội rõ ràng:

1. route-level JS code splitting;
2. route-group CSS splitting sau visual gate;
3. không tải Admin mock/chart code khi học sinh chỉ vào Landing/Marketplace;
4. tách mock data khỏi production adapters sau này;
5. memo hóa chỉ ở vùng tính toán có ích, không bọc mọi component bằng `memo`;
6. giữ filter computation derived bằng `useMemo` nơi dataset local lớn;
7. sau backend, pagination phải được đưa xuống query/database, không filter toàn dataset ở browser.

Phase 2 không được biến các optimization này thành thay đổi UI.

---

## 14. Security boundary preparation

Phase 2 chưa implement authorization, nhưng frontend architecture phải chuẩn bị để **không thể nhầm UI guard với security**.

Target contracts:

```text
AuthSession = identity/current role hint for UI
Permission = UX visibility only
Backend/RLS = authority thật (Phase 3+)
```

Không tạo `isTeacher = true` global rồi coi đó là authorization.

Admin mutation repository sau này phải gọi privileged backend/RPC có server-side authorization + audit.

---

## 15. Research-data boundary

Mock UI data phải tiếp tục được gắn nguồn rõ ràng và không chảy vào research analytics.

Architecture target tách:

```text
features/analytics/operational
features/research-data (sau này, chỉ khi được yêu cầu)
```

Không để `dashboard summary` tự động trở thành “số liệu nghiên cứu”.

---

## 16. Architecture risks ranked

| ID | Risk | Severity | Phase xử lý |
|---|---|---:|---|
| FA-03 | Page phụ thuộc concrete mock/local store, chưa có repository boundary | Critical | **2D** |
| FA-01 | Tất cả page eager import vào initial graph | High | **2B** |
| FA-02 | Global CSS có nhiều selector collision/cascade dependency | High | **2C, từng nhóm** |
| FA-05 | Admin/MyPosts/Marketplace page quá nhiều trách nhiệm | High | **2C** |
| FA-04 | Post types/constants/helper bị lặp | Medium | **2C** |
| FA-06 | `document.body.className` side effect nằm rải ở page | Medium | **2B** |
| FA-07 | Module-level mutable stores không có abstraction/subscription | Medium | **2D** |
| FA-08 | Form Add/Edit lặp validation/media lifecycle | Medium | **2C** |
| FA-09 | Router mapping/switch thủ công chưa có lazy/error boundary | Medium | **2B** |

Không có finding nào yêu cầu redesign.

---

## 17. Proposed target tree after Phase 2

Đây là target, **không phải yêu cầu đổi tất cả trong một commit**:

```text
src/
  app/
    App.tsx
    router/
      legacyRouter.ts
      routeRegistry.ts
      routeMeta.ts
    providers/
      AppProviders.tsx

  components/
    layout/
    student/
    ui/

  features/
    auth/
      hooks/
      services/
      types/
    posts/
      model/
      components/
      hooks/
      repositories/
    marketplace/
      components/
      hooks/
      repositories/
    favorites/
      repositories/
    comments/
      repositories/
    profile/
      components/
      hooks/
      repositories/
    notifications/
      repositories/
    admin/
      components/
      hooks/
      repositories/

  pages/
    LandingPage.tsx
    MarketplacePage.tsx
    ...

  shared/
    lib/
    types/

  data/
    mock/

  styles/
    legacy/
    compatibility/
```

Lưu ý: feature split phải phản ánh domain thật; không tách file chỉ để đạt “folder đẹp”.

---

## 18. Phase 2 checkpoint plan

### 2A — Architecture Audit ✅

- inventory;
- duplication/coupling;
- state ownership;
- data boundary;
- CSS risk;
- target tree;
- refactor order.

**Không sửa UI/source behavior.**

### 2B — Application shell + route registry

Mục tiêu:

- central route metadata;
- lazy page imports;
- document title/body class centralization;
- error/loading boundary;
- giữ nguyên `?page=...`;
- không đổi visible UI.

Gate:

- 12/12 route;
- back/forward;
- `detail?id=A → id=B`;
- Landing search flow;
- build;
- desktop/mobile smoke.

### 2C — Feature component modularization

Theo thứ tự giảm rủi ro:

1. shared constants/formatters;
2. Add/Edit shared form logic;
3. Marketplace;
4. My Posts + My Detail;
5. Profile;
6. Admin cuối cùng.

Mỗi bước giữ screenshot/flow baseline.

### 2D — Data-access boundary

- repository contracts;
- mock adapters;
- hooks/use-cases;
- page không import `mock*.ts` hoặc `local*Store.ts` trực tiếp;
- chưa Supabase.

Gate cuối Phase 2:

```text
UI/UX/Flow == Phase 1 baseline
Data source == mock adapter
Backend calls == 0
Direct mock/store import from pages == 0
```

---

## 19. What must remain frozen during Phase 2

Không thay đổi nếu chưa được phê duyệt:

- 12 legacy page names;
- URL/query behavior nhìn thấy bởi người dùng;
- navigation labels;
- landing hierarchy;
- marketplace layout/filter labels;
- post card anatomy;
- add/edit form fields và workflow;
- owner status/action semantics;
- profile privacy controls;
- teacher moderation workflow;
- palette/layout/spacing intentional của baseline;
- moderation ≠ product verification;
- historical research data ≠ operational sample data.

---

## 20. 2A decision

**APPROVED TO PROCEED TO 2B.**

Điều kiện: 2B chỉ refactor app shell/routing/load boundary. Nếu một thay đổi làm khác UI hoặc flow Phase 1, phải rollback hoặc báo xin phê duyệt thay vì “sửa cho hiện đại”.
