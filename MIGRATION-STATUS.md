# mr-marble migration status

Revalidated 2026-10-23 against the local MR-Moqui working tree after the screen migration batches. **772 features in 80 specs: all pass.** 366 of the 371 screen rows are ticked Migrated (exercised through the TUI); none is Validated. The original 2026-10-16/17 validation was 411 features in 45 specs; the growth is Mantle specs added since and three SimpleScreens specs (80 features: `SimpleScreensRender` 54, `MyAccountScreens` 18, `GitScreens` 8). This is a working migration, not a claim of complete browser/authorization/print-layout parity or a released artifact.

The component, repository and directory are `mr-marble` (`git@github.com:moqui/mr-marble.git`); until 2026-10-25 the repository was `MrSimpleScreens` with the component name `SimpleScreens`, and Marble ERP was merged in from `MrMarbleERP` then (the renames are in the MR-Moqui `docs/dev/Moqui-Java-Migration.md`). The screen tree is still `screen/SimpleScreens/`. The unchanged upstream baseline is `5aed7ffba7231babdccfb0bd46cb6db66195487c`. `MIGRATION-INVENTORY.md` is the frozen pre-port inventory (its line numbers and counts describe that upstream source, not the current files). Process: `plans/ScreenMigrationTutorial.md` in MR-Moqui.

## Known failure

None at the last full run. The `EditInvoice` check for invoice 55400 that failed earlier on 2026-10-23 was a stale expectation, not a regression: `ORG_ZIZI_RETAIL` had come only from the GL-account drop-downs in the New Credit Memo / New Payment for Invoice dialogs, which commit `633faeb` correctly hides on a zero unpaid total. The spec now expects `ZIRET: Ziziwork Retail`, `Payment Sent` and `Applied Payments $23,830.00`.

Open items found by the migration batches, for the review pass, are in `MIGRATION-REVIEW-NOTES.md`.

## Implemented

- Mechanical conversion followed by manual ports of screen actions, expressions, transitions and embedded templates. XML layout and Mantle service contracts retained.
- Java collections/classes, closures, map access/copying, decimal operations/truthiness, empty collections and dates converted to the supported JavaScript/host APIs.
- Payment/contact forms flatten nested maps and entity values through `CollectionUtilities.flattenNestedMap`, preserving scalar types. Credit-card year options match Java's ten-year list. Single-use authentication codes use JSON session storage and one-time display.
- All 29 original FreeMarker templates have supported replacements, and the `.ftl` files are removed. Eighteen XSL-FO documents now have HTML-print replacements, with additional fragments for macros/recursive invoice rows. Email and sales-stat/chart templates are ported too. A stored organization or product-store setting that still names a `component://mr-marble/` path ending in `.xsl-fo.ftl` is rewritten to the matching `.print.html.fancy` file. A custom layout outside this component still needs its own port.
- Native browser controls replace jQuery/Bootstrap dependencies: order audit history uses escaped, keyboard-accessible details; report details use dialogs; project status charts use SVG. Nav components use supported request helpers.
- Four calendars use `MrCalendar.js`, a native month/week/day calendar backed by the actual Mantle REST event/task endpoints. Existing create forms and detail links remain. It is a compact agenda/day-column view, not FullCalendar's hourly time-grid.
- Added since the first validation: Git repositories of projects and the commits, branches and tags of tasks (`Project/EditRepositories`, `Project/GitCommit`, `Task/EditSource`, boxes on the project and task summaries, My Account's Git Access, a Content option backed by Git LFS), covered by `GitScreens`; the wiki and product/category content compare screens use the framework's server-side version diff (`ResourceReference.getVersionDiff`) instead of jsdiff from a CDN, with a wiki feature in `SimpleScreensRender`; print headers repeat on every page and the running footer with page number is reproduced; party drop-downs and person lookups leave out another user's personal contact (`Party.privateOwnerUserId`); record-update notification topics go to the automatic Updates inbox; ProjectSummary and the find screens no longer call host decimal `valueOf` or Groovy `take()`; `EditInvoice` payment dialogs hide on a zero unpaid total; `SimpleReport` `FieldList` arrays; `component.xml` dependencies renamed (`mr-mantle`, no component prefixes).
- Supporting host fixes/additions include print query-mode selection and standalone rendering, real Code 128 SVG, flattening, session/form/entity helpers and the APIs described in the tutorial. These host changes must ship with the component.

## Verified results (2026-10-23)

| Check | Result |
| --- | --- |
| Current framework debug build (`cargo build -p moqui`) | Pass |
| All Mantle + mr-marble specs (`moqui test mr-mantle mr-marble`) | **772 passed, 0 failed; 80 specs** |
| Component Groovy lint (`moqui lint --groovy`) | **0 parse failures**, 384 files / 9,929 expression sites; 64 flagged sites (14 `gstring-dollar-name`, 47 `static-class`, 3 `empty-collection-truthiness`) |
| Runtime screen lint (`moqui lint --screens`) | **0 parse failures**, 919 files / 20,546 expression sites (whole runtime, base components included) |
| Component XML syntax | 0 files that do not parse |

Not rerun on 2026-10-23 and carried from the first validation (2026-10-16/17): MR-Moqui core unit tests (939 passed, 0 failed, 1 ignored), host print regressions (18), Code 128 library tests (3), webroot JS tests (27), and the Chromium browser/PDF checks below. The feature count includes 687 Mantle features and 85 screen features; the discovery feature loops over many screens, so feature count is not unique-screen count.

The one Groovy file the lint does not parse is `src/test/groovy/MyAccountScreenTests.groovy`, the retained original test, which the JS runner does not execute. The 14 `$` form-location strings (the `gstring-dollar-name` flags) and the three Boolean `hasNoItems` conditions are false positives and were not changed to hide warnings. Eight print screens still mention `.xsl-fo.ftl` inside the expression that rewrites a stored setting to `.print.html.fancy`. A custom template location outside this component still needs a runtime test.

## Actual browser and PDF checks (2026-10-16/17)

These were run once, before the Git, compare, print-header and privacy changes above; they have not been repeated.

Authenticated Chromium smoke checks passed customer lookup, order detail, invoice, payment and My Account, with **zero uncaught JavaScript exceptions**. The order HTML-print page contained real SVG barcode bars; Chromium generated a PDF and `pdftotext` confirmed the supplier/customer, product descriptions and `$23,795.00` total.

The browser smoke used a temporary SimpleScreens app mount and an explicit **test-only ADMIN authorization grant in an isolated runtime**. SimpleScreens is normally mounted by an application such as MarbleERP/PopCommerce; its own default configuration mounts only My Account. The initial 403 without an app grant was preserved as a useful authorization check, not bypassed globally. No production grant or application mount was added to component data.

Additional scoped Chromium checks exercised all four HTML calendars with successful REST requests, month/week/day navigation, event creation dialog opening, live QVT calendar rendering with three real tasks, Vue/Quasar nav mounting, sales-summary dialog opening/closing and project SVG output. Isolated calendar fixtures checked exclusive-end multi-day events, HTML-looking titles, unsafe link rejection and independent source failures.

The browser smoke is now the client spec `test/client/BrowserSmoke.spec.js` (`moqui test-client mr-marble --serve`), whose server mounts the app in `test/MoquiConf.xml` and makes the test-only grant in `test/ClientAccess.spec.js`, both in test runs only. Defaults are for disposable local demo data only. See `test/README.md`.

## Screen checklist

One row per screen XML under `screen/` (371), sorted by path below `screen/`, case-insensitive. Tick a box by editing `[ ]` to `[x]` in the same commit as the work.

**Migrated** means both: the source is converted (Groovy to JavaScript, Java classes and collections to the supported APIs, FreeMarker/XSL-FO to supported templates, jQuery/CDN libraries to native controls), and the screen has been exercised through the TUI. The TUI pass is the first-pass check because an agent can drive it from a terminal and iterate quickly. **Validated** is a later phase: the screen checked in a browser (rendering, dialogs, AJAX and transitions, print output, authorization as the mounting app configures it). Do not tick Validated during the TUI pass.

Nothing is ticked yet. The earlier JS specs and Chromium smoke runs show some screens render, but they predate this definition and did not go through the TUI, so they do not count. `test/acceptance/ScreenReport.spec.js` writes a report of which screens those specs already reach (`./moq test -D mrss_screen_report=/tmp/mrss-report.md -- mr-mantle mr-marble --acceptance --spec ScreenReport`); use it to choose where to start, not as a source of ticks.

### Process

A full automated test suite is not a goal of this migration. Agents do the testing themselves, as part of changing a screen, and the screen is only as migrated as that testing showed. For each screen:

1. Find what is left to convert: `moqui lint --groovy runtime/components/addon/mr-marble` and `moqui lint --screens`, and `plans/ScreenMigrationTutorial.md`. Keep XML layout and Mantle service contracts; convert in a mechanical pass first and review its diff, then fix by hand (decimals, empty-collection truthiness, dates, copied service parameters).
2. Drive it in the TUI on a runtime with the demo and flow data loaded, as a user with the access the screen needs: `moqui tui --user john.doe --path /apps/SimpleScreens/<path>` (a dev instance only), or `--snapshot <path>` for one rendering and `--agent` for scripted commands (`docs/ui/TUI.md`, For agents). Mount SimpleScreens as an app in the runtime you test in (it normally relies on an application such as MarbleERP or PopCommerce; its own configuration mounts only My Account), and keep any test-only grant out of component data.
3. Exercise what the screen does, not only that it renders: fill and submit its forms, run its transitions and dialogs, try the empty and error cases, and compare results with the data the services should have changed. Fix what is wrong and repeat until it behaves.
4. Tick Migrated for the screen, and note in the commit what was run and anything left over. Add a JS spec feature only where a regression guard is cheap, such as a screen with real fixture data or a bug that was easy to reintroduce; do not add one per screen.
5. Screens that need fixtures (wiki, shipments ready to receive, organization preferences) get the fixtures created in the test runtime as part of testing them.

Practical notes from the TUI passes (BasicHandheld, MyAccount):

- `plans/ScreenMigrationTutorial.md` does not exist; use the other `plans/` documents and the screens already ticked as examples.
- Use a scratch runtime in a short path under `/tmp` (the embedded Postgres socket path must stay under 108 bytes): a copy of `conf/MoquiDevConf.xml` with `ssh_port` 0, symlinks to the repository's `components/base` and each component, and a test-only component for mounts, grants and fixtures. Run `MOQUI_RUNTIME=<scratch> target/debug/moqui tui --agent --user john.doe --size 130x32` with the commands piped on stdin; a run boots in about 5 s and the database persists between runs. Keep test mounts, grants and fixtures out of committed component data, and delete the scratch runtime and throwaway specs when done. A non-admin user (the `worker` of WorkPlanToCashBasicFlow) needs a scratch ALL_USERS grant on the screens to be used; john.doe's ADMIN skips an old-password check, so test those as a plain user.
- Make fixtures with a throwaway spec in the test-only component and `moqui test <thatcomponent> --keep`, then run the TUI on the kept runtime it leaves in `/tmp/mt-*`. `--spec` follows `dependsOn` only inside one component, so a mr-marble spec that depends on Mantle specs cannot be selected alone (the README example fails); copy the spec into the test-only component without its `dependsOn` and name the Mantle flow specs in `--spec`, or run the whole suite. In a repository runtime `mr-marble` sorts before `mr-mantle`, so load order matters for the same reason.
- `moqui load location=<file.xml>` loads a seed file (an `ArtifactAuthz` grant, a `ScreenScheduled` row) into the scratch database between runs; the Tools data grid (`/apps/tools/Data/Grid?selectedEntity=...`) checks what a screen wrote.
- The JavaScript templates under `runtime/components/base/framework/template/screen` are embedded with `include_str!`: rebuild (`cargo build -p moqui`) after editing them, and update the goldens (`UPDATE_GOLDEN=1 cargo test -p moqui-core --lib golden`, `UPDATE_GOLDEN=1 cargo test -p moqui-host --test tui_screens`) when a render changes. Component XML is read at run time and needs no rebuild.
- After a failed form submit the form is dirty and the next `go` shows a "leave with unsaved changes" confirm: `do Discard`, or start a new session. A dialog or row editor takes a command to settle: `set`/`do` by element number (`set #3 ...`, `elements` lists them) is the reliable way to fill a dialog whose fields have no titles.

Validated rows are done later in a browser by the same method, with the print outputs checked as PDF.

| Screen | Migrated | Validated |
| --- | :-: | :-: |
| `BasicHandheld/Warehouse` | [x] | [ ] |
| `BasicHandheld/Warehouse/Asset` | [x] | [ ] |
| `BasicHandheld/Warehouse/Asset/ReceiveAsset` | [x] | [ ] |
| `BasicHandheld/Warehouse/Asset/SelectAsset` | [x] | [ ] |
| `BasicHandheld/Warehouse/dashboard` | [x] | [ ] |
| `BasicHandheld/Warehouse/Shipping` | [x] | [ ] |
| `BasicHandheld/Warehouse/Shipping/PickLocationMoves` | [x] | [ ] |
| `email/InvoiceFinalized` | [ ] | [ ] |
| `email/InvoicesPastDue` | [ ] | [ ] |
| `email/OrderPlaced` | [ ] | [ ] |
| `email/ShipmentShipped` | [ ] | [ ] |
| `MyAccount` | [x] | [ ] |
| `MyAccount/Expense` | [x] | [ ] |
| `MyAccount/Expense/EditExpenseInvoice` | [x] | [ ] |
| `MyAccount/Expense/EditExpenseInvoiceItems` | [x] | [ ] |
| `MyAccount/Expense/FindExpenseInvoice` | [x] | [ ] |
| `MyAccount/User` | [x] | [ ] |
| `MyAccount/User/Account` | [x] | [ ] |
| `MyAccount/User/Calendar` | [x] | [ ] |
| `MyAccount/User/Calendar/EventDetail` | [x] | [ ] |
| `MyAccount/User/Calendar/MyCalendar` | [x] | [ ] |
| `MyAccount/User/ContactInfo` | [x] | [ ] |
| `MyAccount/User/ContactInfo/UpdateContactInfo` | [x] | [ ] |
| `MyAccount/User/GitAccess` | [x] | [ ] |
| `MyAccount/User/Messages` | [x] | [ ] |
| `MyAccount/User/Messages/EditMessage` | [x] | [ ] |
| `MyAccount/User/Messages/FindMessage` | [x] | [ ] |
| `MyAccount/User/Messages/MessageThread` | [x] | [ ] |
| `MyAccount/User/Messages/MessageThread/SingleMessage` | [x] | [ ] |
| `MyAccount/User/Notifications` | [x] | [ ] |
| `MyAccount/User/Request` | [x] | [ ] |
| `MyAccount/User/Request/EditRequest` | [x] | [ ] |
| `MyAccount/User/Request/EditRequest/RequestCommentNested` | [x] | [ ] |
| `MyAccount/User/Request/EditRequest/RequestCommentReply` | [x] | [ ] |
| `MyAccount/User/Request/EditRequest/RequestCommentUpdate` | [x] | [ ] |
| `MyAccount/User/Request/MyRequests` | [x] | [ ] |
| `MyAccount/User/ScheduledFinds` | [x] | [ ] |
| `MyAccount/User/ScheduledFinds/EditScheduledFind` | [x] | [ ] |
| `MyAccount/User/Task` | [x] | [ ] |
| `MyAccount/User/Task/MyTasks` | [x] | [ ] |
| `MyAccount/User/Task/TaskDetail` | [x] | [ ] |
| `MyAccount/User/TimeEntries` | [x] | [ ] |
| `SimpleScreens` | [x] | [ ] |
| `SimpleScreens/Accounting` | [x] | [ ] |
| `SimpleScreens/Accounting/Budget` | [x] | [ ] |
| `SimpleScreens/Accounting/Budget/BudgetAccountsEntry` | [x] | [ ] |
| `SimpleScreens/Accounting/Budget/BudgetReport` | [x] | [ ] |
| `SimpleScreens/Accounting/Budget/EditBudget` | [x] | [ ] |
| `SimpleScreens/Accounting/Budget/EditBudgetItems` | [x] | [ ] |
| `SimpleScreens/Accounting/Budget/FindBudget` | [x] | [ ] |
| `SimpleScreens/Accounting/dashboard` | [x] | [ ] |
| `SimpleScreens/Accounting/dashboard/OrgInternalSummary` | [x] | [ ] |
| `SimpleScreens/Accounting/FinancialAccount` | [x] | [ ] |
| `SimpleScreens/Accounting/FinancialAccount/EditFinancialAccount` | [x] | [ ] |
| `SimpleScreens/Accounting/FinancialAccount/FinancialAccountStatement` | [x] | [ ] |
| `SimpleScreens/Accounting/FinancialAccount/FinancialAccountTrans` | [x] | [ ] |
| `SimpleScreens/Accounting/FinancialAccount/FindFinancialAccount` | [x] | [ ] |
| `SimpleScreens/Accounting/FindJournal` | [x] | [ ] |
| `SimpleScreens/Accounting/GlAccount` | [x] | [ ] |
| `SimpleScreens/Accounting/GlAccount/EditGlAccount` | [x] | [ ] |
| `SimpleScreens/Accounting/GlAccount/FindGlAccount` | [x] | [ ] |
| `SimpleScreens/Accounting/GlAccount/GlAccountTree` | [x] | [ ] |
| `SimpleScreens/Accounting/Invoice` | [x] | [ ] |
| `SimpleScreens/Accounting/Invoice/Aging` | [x] | [ ] |
| `SimpleScreens/Accounting/Invoice/EditInvoice` | [x] | [ ] |
| `SimpleScreens/Accounting/Invoice/EditInvoiceItemDetails` | [x] | [ ] |
| `SimpleScreens/Accounting/Invoice/EditInvoiceItemOrders` | [x] | [ ] |
| `SimpleScreens/Accounting/Invoice/EditInvoiceItems` | [x] | [ ] |
| `SimpleScreens/Accounting/Invoice/EditInvoiceItemShipments` | [x] | [ ] |
| `SimpleScreens/Accounting/Invoice/FindInvoice` | [x] | [ ] |
| `SimpleScreens/Accounting/Invoice/PrintInvoice` | [x] | [ ] |
| `SimpleScreens/Accounting/Invoice/ReceivableStatement` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings/AcctgPreference` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings/AssetTypes` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings/FinAcctReasons` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings/FinAcctTypes` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings/GlAccounts` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings/InvoiceTypes` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings/ItemTypes` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings/PaymentInstruments` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings/PaymentTypes` | [x] | [ ] |
| `SimpleScreens/Accounting/OrgSettings/TypeDefaults` | [x] | [ ] |
| `SimpleScreens/Accounting/Payment` | [x] | [ ] |
| `SimpleScreens/Accounting/Payment/BulkPaymentCheck` | [x] | [ ] |
| `SimpleScreens/Accounting/Payment/EditPayment` | [x] | [ ] |
| `SimpleScreens/Accounting/Payment/FindPayment` | [x] | [ ] |
| `SimpleScreens/Accounting/Payment/PaymentCheck` | [x] | [ ] |
| `SimpleScreens/Accounting/Payment/PaymentDetail` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/AccountBalance` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/AccountLedger` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/ArAgingSummary` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/AssetOnHand` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/AssetOnHandSummary` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/AssetReceiptTransaction` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/AssetStatusByReceipt` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/AssetValuation` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/BalanceSheet` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/CashFlowStatement` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/FinancialRatios` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/IncomeStatement` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/InvoiceAgingDetail` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/InvoiceItemSummary` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/InvoiceReconciliation` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/OrderIssuedInvoiced` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/OrderItemSummary` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/PostedAmountSummary` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/PostedBalanceSummary` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/ReportList` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/RetainedEarningsStatement` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/SalesAnalysis` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/SalesInvoiceAnalysis` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/SalesSummary` | [x] | [ ] |
| `SimpleScreens/Accounting/Reports/ShipmentPackageSummary` | [x] | [ ] |
| `SimpleScreens/Accounting/TimePeriod` | [x] | [ ] |
| `SimpleScreens/Accounting/TimePeriod/EditTimePeriod` | [x] | [ ] |
| `SimpleScreens/Accounting/TimePeriod/FindTimePeriod` | [x] | [ ] |
| `SimpleScreens/Accounting/TimePeriod/ViewPeriodGlAccounts` | [x] | [ ] |
| `SimpleScreens/Accounting/Transaction` | [x] | [ ] |
| `SimpleScreens/Accounting/Transaction/EditTransaction` | [x] | [ ] |
| `SimpleScreens/Accounting/Transaction/EditTransaction/MoveEntry` | [x] | [ ] |
| `SimpleScreens/Accounting/Transaction/FindTransaction` | [x] | [ ] |
| `SimpleScreens/Accounting/Transaction/FindTransactionEntry` | [x] | [ ] |
| `SimpleScreens/Asset` | [x] | [ ] |
| `SimpleScreens/Asset/Asset` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/AssetCalendar` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/AssetDetail` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/AssetMaintenance` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/AssetMaintenance/EditAssetMaintenance` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/AssetMaintenance/FindAssetMaintenance` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/AssetMeters` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/AssetParties` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/AssetRegistrations` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/DetailHistory` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/FindAsset` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/FindSummary` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/FindSummary/PhysicalChange` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/FindSummary/PhysicalQuantity` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/MoveAsset` | [x] | [ ] |
| `SimpleScreens/Asset/Asset/SelectAsset` | [x] | [ ] |
| `SimpleScreens/Asset/AssetPool` | [x] | [ ] |
| `SimpleScreens/Asset/AssetPool/EditAssetPool` | [x] | [ ] |
| `SimpleScreens/Asset/AssetPool/FindAssetPool` | [x] | [ ] |
| `SimpleScreens/Asset/Container` | [x] | [ ] |
| `SimpleScreens/Asset/Container/EditContainer` | [x] | [ ] |
| `SimpleScreens/Asset/Container/FindContainer` | [x] | [ ] |
| `SimpleScreens/Asset/Container/MoveContainer` | [x] | [ ] |
| `SimpleScreens/Asset/dashboard` | [x] | [ ] |
| `SimpleScreens/Asset/EditLots` | [x] | [ ] |
| `SimpleScreens/Asset/PhysicalInventory` | [x] | [ ] |
| `SimpleScreens/Asset/PhysicalInventory/EditPhysicalInventory` | [x] | [ ] |
| `SimpleScreens/Asset/PhysicalInventory/FindPhysicalInventory` | [x] | [ ] |
| `SimpleScreens/Catalog` | [x] | [ ] |
| `SimpleScreens/Catalog/Category` | [x] | [ ] |
| `SimpleScreens/Catalog/Category/Content` | [x] | [ ] |
| `SimpleScreens/Catalog/Category/Content/ContentCompare` | [x] | [ ] |
| `SimpleScreens/Catalog/Category/Content/ContentDetail` | [x] | [ ] |
| `SimpleScreens/Catalog/Category/Content/ContentList` | [x] | [ ] |
| `SimpleScreens/Catalog/Category/EditCategory` | [x] | [ ] |
| `SimpleScreens/Catalog/Category/EditProducts` | [x] | [ ] |
| `SimpleScreens/Catalog/Category/FindCategory` | [x] | [ ] |
| `SimpleScreens/Catalog/dashboard` | [x] | [ ] |
| `SimpleScreens/Catalog/Feature` | [x] | [ ] |
| `SimpleScreens/Catalog/Feature/EditFeature` | [x] | [ ] |
| `SimpleScreens/Catalog/Feature/FindFeature` | [x] | [ ] |
| `SimpleScreens/Catalog/FeatureGroup` | [x] | [ ] |
| `SimpleScreens/Catalog/FeatureGroup/EditFeatureGroup` | [x] | [ ] |
| `SimpleScreens/Catalog/FeatureGroup/FindFeatureGroup` | [x] | [ ] |
| `SimpleScreens/Catalog/Product` | [x] | [ ] |
| `SimpleScreens/Catalog/Product/Content` | [x] | [ ] |
| `SimpleScreens/Catalog/Product/Content/ContentCompare` | [x] | [ ] |
| `SimpleScreens/Catalog/Product/Content/ContentDetail` | [x] | [ ] |
| `SimpleScreens/Catalog/Product/Content/ContentList` | [x] | [ ] |
| `SimpleScreens/Catalog/Product/EditAssocs` | [x] | [ ] |
| `SimpleScreens/Catalog/Product/EditCategories` | [x] | [ ] |
| `SimpleScreens/Catalog/Product/EditPrices` | [x] | [ ] |
| `SimpleScreens/Catalog/Product/EditProduct` | [x] | [ ] |
| `SimpleScreens/Catalog/Product/FindProduct` | [x] | [ ] |
| `SimpleScreens/Catalog/Search` | [x] | [ ] |
| `SimpleScreens/Customer` | [x] | [ ] |
| `SimpleScreens/Customer/CustomerData` | [x] | [ ] |
| `SimpleScreens/Customer/EditCustomer` | [x] | [ ] |
| `SimpleScreens/Customer/FindCustomer` | [x] | [ ] |
| `SimpleScreens/Facility` | [x] | [ ] |
| `SimpleScreens/Facility/BoxTypes` | [x] | [ ] |
| `SimpleScreens/Facility/CarrierShipMethods` | [x] | [ ] |
| `SimpleScreens/Facility/EditFacility` | [x] | [ ] |
| `SimpleScreens/Facility/EditFacilityLocations` | [x] | [ ] |
| `SimpleScreens/Facility/EditFacilityProducts` | [x] | [ ] |
| `SimpleScreens/Facility/FacilityCalendar` | [x] | [ ] |
| `SimpleScreens/Facility/FindFacility` | [x] | [ ] |
| `SimpleScreens/Facility/PrintBoxTypes` | [x] | [ ] |
| `SimpleScreens/Gateway` | [x] | [ ] |
| `SimpleScreens/Gateway/Payment` | [x] | [ ] |
| `SimpleScreens/Gateway/Payment/EditPaymentGateway` | [x] | [ ] |
| `SimpleScreens/Gateway/Payment/FindPaymentGateway` | [x] | [ ] |
| `SimpleScreens/Gateway/Shipping` | [x] | [ ] |
| `SimpleScreens/Gateway/Shipping/EditShippingGateway` | [x] | [ ] |
| `SimpleScreens/Gateway/Shipping/FindShippingGateway` | [x] | [ ] |
| `SimpleScreens/HumanRes` | [x] | [ ] |
| `SimpleScreens/HumanRes/dashboard` | [x] | [ ] |
| `SimpleScreens/HumanRes/EditRateAmounts` | [x] | [ ] |
| `SimpleScreens/Manufacturing` | [x] | [ ] |
| `SimpleScreens/Manufacturing/dashboard` | [x] | [ ] |
| `SimpleScreens/Manufacturing/Run` | [x] | [ ] |
| `SimpleScreens/Manufacturing/Run/EditRun` | [x] | [ ] |
| `SimpleScreens/Manufacturing/Run/FindRun` | [x] | [ ] |
| `SimpleScreens/Manufacturing/Run/RunConsumed` | [x] | [ ] |
| `SimpleScreens/Manufacturing/Run/RunPickDocument` | [x] | [ ] |
| `SimpleScreens/Manufacturing/Run/RunProduced` | [x] | [ ] |
| `SimpleScreens/Manufacturing/Run/RunProducts` | [x] | [ ] |
| `SimpleScreens/Manufacturing/Run/RunProducts/ConsumeAsset` | [x] | [ ] |
| `SimpleScreens/Manufacturing/Run/RunProducts/ConsumeProduct` | [x] | [ ] |
| `SimpleScreens/Manufacturing/Run/RunProducts/ProduceAsset` | [x] | [ ] |
| `SimpleScreens/Order` | [x] | [ ] |
| `SimpleScreens/Order/FindOrder` | [x] | [ ] |
| `SimpleScreens/Order/OrderDetail` | [x] | [ ] |
| `SimpleScreens/Order/OrderDetail/EditItem` | [x] | [ ] |
| `SimpleScreens/Order/OrderDetail/ItemReserve` | [x] | [ ] |
| `SimpleScreens/Order/OrderDetail/ReturnItem` | [x] | [ ] |
| `SimpleScreens/Order/OrderItems` | [x] | [ ] |
| `SimpleScreens/Order/PrintOrder` | [x] | [ ] |
| `SimpleScreens/Order/QuickItems` | [x] | [ ] |
| `SimpleScreens/Party` | [x] | [ ] |
| `SimpleScreens/Party/EditParty` | [x] | [ ] |
| `SimpleScreens/Party/EditParty/ExpiredContactOther` | [x] | [ ] |
| `SimpleScreens/Party/EditParty/ExpiredPostal` | [x] | [ ] |
| `SimpleScreens/Party/EditParty/FindDuplicates` | [x] | [ ] |
| `SimpleScreens/Party/EditParty/UpdateContactInfo` | [x] | [ ] |
| `SimpleScreens/Party/EditParty/UpdatePaymentMethodInfo` | [x] | [ ] |
| `SimpleScreens/Party/FinancialInfo` | [x] | [ ] |
| `SimpleScreens/Party/FindParty` | [x] | [ ] |
| `SimpleScreens/Party/PartyAgreements` | [x] | [ ] |
| `SimpleScreens/Party/PartyAgreements/EditAgreement` | [x] | [ ] |
| `SimpleScreens/Party/PartyAgreements/FindAgreement` | [x] | [ ] |
| `SimpleScreens/Party/PartyCalendar` | [x] | [ ] |
| `SimpleScreens/Party/PartyEmails` | [x] | [ ] |
| `SimpleScreens/Party/PartyMessages` | [x] | [ ] |
| `SimpleScreens/Party/PartyProjects` | [x] | [ ] |
| `SimpleScreens/Party/PartyRelated` | [x] | [ ] |
| `SimpleScreens/Party/PartyRequests` | [x] | [ ] |
| `SimpleScreens/Party/PartyTasks` | [x] | [ ] |
| `SimpleScreens/Party/PartyTimeEntries` | [x] | [ ] |
| `SimpleScreens/Party/PartyTimeEntries/EditTimeEntry` | [x] | [ ] |
| `SimpleScreens/Party/PaymentMethod` | [x] | [ ] |
| `SimpleScreens/Party/PaymentMethod/EditPaymentMethod` | [x] | [ ] |
| `SimpleScreens/Party/PaymentMethod/PaymentGatewayResponses` | [x] | [ ] |
| `SimpleScreens/Party/PaymentMethod/PaymentMethodChecks` | [x] | [ ] |
| `SimpleScreens/Party/PaymentMethod/PaymentMethodFiles` | [x] | [ ] |
| `SimpleScreens/Party/PaymentMethod/PaymentMethodTrans` | [x] | [ ] |
| `SimpleScreens/Party/PaymentMethod/PaymentMethodTrans/CreatePayment` | [x] | [ ] |
| `SimpleScreens/ProductStore` | [x] | [ ] |
| `SimpleScreens/ProductStore/EditProductStore` | [x] | [ ] |
| `SimpleScreens/ProductStore/FindProductStore` | [x] | [ ] |
| `SimpleScreens/ProductStore/FindProductStoreCategory` | [x] | [ ] |
| `SimpleScreens/ProductStore/FindProductStoreEmails` | [x] | [ ] |
| `SimpleScreens/ProductStore/FindProductStoreFacility` | [x] | [ ] |
| `SimpleScreens/ProductStore/FindProductStoreParty` | [x] | [ ] |
| `SimpleScreens/ProductStore/FindProductStoreSettings` | [x] | [ ] |
| `SimpleScreens/ProductStore/Promotion` | [x] | [ ] |
| `SimpleScreens/ProductStore/Promotion/EditPromotion` | [x] | [ ] |
| `SimpleScreens/ProductStore/Promotion/FindPromotion` | [x] | [ ] |
| `SimpleScreens/ProductStore/Promotion/PromoCode` | [x] | [ ] |
| `SimpleScreens/ProductStore/Promotion/PromoCode/EditPromoCode` | [x] | [ ] |
| `SimpleScreens/ProductStore/Promotion/PromoCode/FindPromoCode` | [x] | [ ] |
| `SimpleScreens/Project` | [x] | [ ] |
| `SimpleScreens/Project/EditMilestones` | [x] | [ ] |
| `SimpleScreens/Project/EditProject` | [x] | [ ] |
| `SimpleScreens/Project/EditRepositories` | [x] | [ ] |
| `SimpleScreens/Project/EditUsers` | [x] | [ ] |
| `SimpleScreens/Project/EditWikiPages` | [x] | [ ] |
| `SimpleScreens/Project/FindProject` | [x] | [ ] |
| `SimpleScreens/Project/GitCommit` | [x] | [ ] |
| `SimpleScreens/Project/MilestoneSummary` | [x] | [ ] |
| `SimpleScreens/Project/ProjectProgressReport` | [x] | [ ] |
| `SimpleScreens/Project/ProjectSummary` | [x] | [ ] |
| `SimpleScreens/Project/ProjectTimeEntries` | [x] | [ ] |
| `SimpleScreens/QuickLookup` | [x] | [ ] |
| `SimpleScreens/QuickSearch` | [x] | [ ] |
| `SimpleScreens/Request` | [x] | [ ] |
| `SimpleScreens/Request/EditRequest` | [x] | [ ] |
| `SimpleScreens/Request/EditRequest/RequestCommentNested` | [x] | [ ] |
| `SimpleScreens/Request/EditRequest/RequestCommentReply` | [x] | [ ] |
| `SimpleScreens/Request/EditRequest/RequestCommentUpdate` | [x] | [ ] |
| `SimpleScreens/Request/EditRequestItems` | [x] | [ ] |
| `SimpleScreens/Request/EditTasks` | [x] | [ ] |
| `SimpleScreens/Request/EditUsers` | [x] | [ ] |
| `SimpleScreens/Request/EditWikiPages` | [x] | [ ] |
| `SimpleScreens/Request/FindRequest` | [x] | [ ] |
| `SimpleScreens/Return` | [x] | [ ] |
| `SimpleScreens/Return/AddOrderItems` | [x] | [ ] |
| `SimpleScreens/Return/EditReturn` | [x] | [ ] |
| `SimpleScreens/Return/EditReturnItems` | [x] | [ ] |
| `SimpleScreens/Return/FindReturn` | [x] | [ ] |
| `SimpleScreens/Search` | [x] | [ ] |
| `SimpleScreens/Shipment` | [x] | [ ] |
| `SimpleScreens/Shipment/FindShipment` | [x] | [ ] |
| `SimpleScreens/Shipment/PackageTracking` | [x] | [ ] |
| `SimpleScreens/Shipment/ShipmentByPackage` | [x] | [ ] |
| `SimpleScreens/Shipment/ShipmentDetail` | [x] | [ ] |
| `SimpleScreens/Shipment/ShipmentDetail/ItemReserve` | [x] | [ ] |
| `SimpleScreens/Shipment/ShipmentDetail/ReceiveItem` | [x] | [ ] |
| `SimpleScreens/Shipment/ShipmentDetail/UpdateItemAsset` | [x] | [ ] |
| `SimpleScreens/Shipment/ShipmentInsert` | [x] | [ ] |
| `SimpleScreens/Shipment/ShipmentItems` | [x] | [ ] |
| `SimpleScreens/Shipment/ShipmentPack` | [x] | [ ] |
| `SimpleScreens/Shipment/ShipmentPackages` | [x] | [ ] |
| `SimpleScreens/Shipment/ShipmentPick` | [x] | [ ] |
| `SimpleScreens/Shipping` | [x] | [ ] |
| `SimpleScreens/Shipping/dashboard` | [x] | [ ] |
| `SimpleScreens/Shipping/PackShipment` | [x] | [ ] |
| `SimpleScreens/Shipping/PackShipment/PackItems` | [x] | [ ] |
| `SimpleScreens/Shipping/PackShipment/PackPackages` | [x] | [ ] |
| `SimpleScreens/Shipping/PackShipment/PackSummary` | [x] | [ ] |
| `SimpleScreens/Shipping/PackShipment/PackSummary/PackCompleted` | [x] | [ ] |
| `SimpleScreens/Shipping/Picklist` | [x] | [ ] |
| `SimpleScreens/Shipping/Picklist/AddOrder` | [x] | [ ] |
| `SimpleScreens/Shipping/Picklist/AddShipment` | [x] | [ ] |
| `SimpleScreens/Shipping/Picklist/BulkPicklist` | [x] | [ ] |
| `SimpleScreens/Shipping/Picklist/FindPicklist` | [x] | [ ] |
| `SimpleScreens/Shipping/Picklist/PicklistDetail` | [x] | [ ] |
| `SimpleScreens/Shipping/Picklist/ShipmentLoadPick` | [x] | [ ] |
| `SimpleScreens/Shipping/Picklist/ShipmentLoadPickAndPack` | [x] | [ ] |
| `SimpleScreens/Shipping/PickLocationMoves` | [x] | [ ] |
| `SimpleScreens/Shipping/PickLocationMoves/QuickMove` | [x] | [ ] |
| `SimpleScreens/SimpleReport` | [x] | [ ] |
| `SimpleScreens/SimpleReport/EditReport` | [x] | [ ] |
| `SimpleScreens/SimpleReport/EditReport/FieldList` | [x] | [ ] |
| `SimpleScreens/SimpleReport/FindReport` | [x] | [ ] |
| `SimpleScreens/SimpleReport/QuickViewReport` | [x] | [ ] |
| `SimpleScreens/SimpleReport/ViewReport` | [x] | [ ] |
| `SimpleScreens/Supplier` | [x] | [ ] |
| `SimpleScreens/Supplier/EditSupplier` | [x] | [ ] |
| `SimpleScreens/Supplier/FindSupplier` | [x] | [ ] |
| `SimpleScreens/Survey` | [x] | [ ] |
| `SimpleScreens/Survey/EditSurvey` | [x] | [ ] |
| `SimpleScreens/Survey/Fields` | [x] | [ ] |
| `SimpleScreens/Survey/FindSurvey` | [x] | [ ] |
| `SimpleScreens/Survey/ResponseDetails` | [x] | [ ] |
| `SimpleScreens/Survey/Responses` | [x] | [ ] |
| `SimpleScreens/Survey/ResponseStats` | [x] | [ ] |
| `SimpleScreens/Task` | [x] | [ ] |
| `SimpleScreens/Task/EditRelated` | [x] | [ ] |
| `SimpleScreens/Task/EditRequests` | [x] | [ ] |
| `SimpleScreens/Task/EditSource` | [x] | [ ] |
| `SimpleScreens/Task/EditTask` | [x] | [ ] |
| `SimpleScreens/Task/EditTimeEntries` | [x] | [ ] |
| `SimpleScreens/Task/EditUsers` | [x] | [ ] |
| `SimpleScreens/Task/EditWikiPages` | [x] | [ ] |
| `SimpleScreens/Task/FindTask` | [x] | [ ] |
| `SimpleScreens/Task/TaskSummary` | [x] | [ ] |
| `SimpleScreens/Task/TaskSummary/TaskCommentNested` | [x] | [ ] |
| `SimpleScreens/Task/TaskSummary/TaskCommentReply` | [x] | [ ] |
| `SimpleScreens/Task/TaskSummary/TaskCommentUpdate` | [x] | [ ] |
| `SimpleScreens/Vendor` | [x] | [ ] |
| `SimpleScreens/Vendor/EditUsers` | [x] | [ ] |
| `SimpleScreens/Vendor/EditVendor` | [x] | [ ] |
| `SimpleScreens/Vendor/FindVendor` | [x] | [ ] |
| `SimpleScreens/Wiki` | [x] | [ ] |
| `SimpleScreens/Wiki/EditWikiBlog` | [x] | [ ] |
| `SimpleScreens/Wiki/EditWikiPage` | [x] | [ ] |
| `SimpleScreens/Wiki/EditWikiSpace` | [x] | [ ] |
| `SimpleScreens/Wiki/ViewWikiPage` | [x] | [ ] |
| `SimpleScreens/Wiki/wiki` | [x] | [ ] |
| `SimpleScreens/Wiki/wiki/WikiCommentNested` | [x] | [ ] |
| `SimpleScreens/Wiki/wiki/WikiCommentReply` | [x] | [ ] |
| `SimpleScreens/Wiki/WikiBlogs` | [x] | [ ] |
| `SimpleScreens/Wiki/WikiCompare` | [x] | [ ] |
| `SimpleScreens/Wiki/WikiSpaces` | [x] | [ ] |
| `ssstatic` | [ ] | [ ] |

## Remaining acceptance work / limits

- In-process specs disable authorization around individual features. Neither those specs nor the explicitly granted browser smoke establish a full production role/organization-isolation/CSRF policy.
- The wiki and content compare screens now render the server-side diff and are covered by a wiki feature in `SimpleScreensRender`; the diff display has not been exercised in a browser. No external diff library remains.
- Shipment scan-receive's native dialog integration is syntax/lint checked, not end-to-end scanned/received in-browser; the available shipment fixture was already ineligible.
- Organization preference mutation and every dialog/AJAX/transition/client widget have not been exhaustively exercised.
- HTML-print content and an actual order PDF are verified, **not pixel/FOP pagination parity or physical check-stock alignment**. CSS retains check/card coordinates and table headings; general FO repeated running regions/page citations are not fully equivalent. Private `component://`/`content://` logo/signature URIs may need browser-resolvable/data URLs. Test every deployed custom print layout and printer.
- The migration is committed and pushed (first pass 2026-10-16, then the commits above), but there is no release or tag; reproducibility rests on the component and the MR-Moqui host at matching revisions. The Git screens need the framework's optional git feature.

## Evidence

The first validation's logs were under `/tmp/mrss-*` and are gone. The 2026-10-23 run: `target/debug/moqui test mr-mantle mr-marble` (log `/tmp/mrss-now.log`, not retained), `moqui lint --groovy runtime/components/addon/mr-marble` and `moqui lint --screens`. Reproduction commands and dependency requirements are in `test/README.md`.

# Marble ERP

Merged from the mr-marble repository, as it was there.

## mr-marble migration — 2026-10-17

MR-Moqui port of `moqui/MarbleERP` at `dfbea90`. Repository: https://github.com/moqui/mr-marble (master); upstream remains https://github.com/moqui/MarbleERP. The component name stayed **MarbleERP** until the 2026-10-25 merge into mr-marble, preserving component locations, authorization artifacts and `/apps/marble` mounting. `/qapps/marble` also works.

### Work performed

1. Cloned upstream unchanged and pushed that history first. `MIGRATION-INVENTORY.md` freezes the original component lint: 3 XML files, 47 expression sites, 30 parse failures, 28 flagged sites. Whole-runtime screen lint initially had 29 parse failures. `linkCondition` data attributes are not covered by that lint, so they were inspected and tested separately.
2. Used a disposable runtime under `/tmp` with components/base, mr-mantle, mr-marble and this component. Built the current framework with `cargo build -p moqui`.
3. The pristine load stopped at the Java-only `moqui-fop` dependency. Removing that dependency was necessary before the pre-conversion load could pass. Print content now comes from mr-marble's HTML-print replacements and MR-Moqui's Chromium PDF path, not FOP.
4. Mechanical conversion rewrote 26 parameter maps and one data-link Elvis expression in two files. Parse failures fell from 30 to 3. Converter output is committed separately from the hand port.
5. Hand ported `orgPartyRoles*.partyId` to `map`, the inline FreeMarker organization chooser to the fancy dialect, and the two stored party-link role conditions to JavaScript `some`. Replaced the chooser's jQuery/Bootstrap dropdown/tooltip with native `details` and DOM relocation. Organization names are HTML-escaped and IDs URL-encoded.
6. Added `test/MarbleScreens.spec.js` and the Chromium smoke, now `test/client/BrowserSmoke.spec.js`.

Marble owns only its shell and dashboard; most ERP screens are mounted from SimpleScreens. No Mantle business services were copied into this component. Authorization data and the `MANTLE_ACTIVE_ORG` filters are retained unchanged; no global bypass or new user grant was added.

### Validation

- Component lint: **0 parse failures, 0 flagged sites**; one inline fancy body compiled.
- Whole-runtime screen lint: **0 parse failures**; 31 existing flagged sites in components/base/SimpleScreens, plus eight legacy print-location compatibility adapters. These are not Marble findings.
- `screen-port-scan.py` for Marble: no candidates. All component XML passes `xmllint --noout`.
- Fresh all-data load with entity ECAs enabled: **8,359 records, 571 tables created, zero table/data errors, exit 0**. Marble's setup file loads 26 records. Reloading all demo data onto an already populated database is not an idempotency test: upstream's immutable AssetDetail records can fail on the second load, while the loader continues to other files.
- Final full run: **429 features passed, 0 failed/ignored/skipped, 46 specs** (344 Mantle, 67 SimpleScreens, 18 Marble). Marble includes discovery of parameter-free mounted pages, populated customer/supplier/order/invoice/payment/report pages, order/invoice printing, chooser states, stored role conditions for null/empty/mixed roles, and wiki-link expansion.
- Core unit suite: **940 passed, 0 failed, 1 ignored**.
- Real authenticated Chromium: HTML dashboard/customer/supplier/order/invoice/payment, organization select/clear through the existing preference transition, QVT dashboard/order, SVG barcode and actual order PDF. **Zero uncaught exceptions and zero HTTP failures.** Extracted PDF text contains Ziziwork Retail, Demo Product One-One and `$23,795.00`. Dashboard screenshot inspected.

Evidence from this run (local, not portable fixtures): `/tmp/mrmarble-final-tests.log`, `/tmp/mrmarble-final-junit`, `/tmp/mrmarble-clean-load.log`, `/tmp/mrmarble-core-tests.log`, `/tmp/mrmarble-browser-results.json`, `/tmp/mrmarble-dashboard.png`, `/tmp/mrmarble-order.pdf` and `/tmp/mrmarble-order.txt`.

### Required framework support

Use the current MR-Moqui source and the ported mr-marble, not an older release binary or upstream SimpleScreens. This was validated with mr-mantle `14d327b`, mr-mantle `50be8e3`, and the in-progress mr-marble migration based on `2c1ba93` (its migration and supporting framework edits were already present locally).

Chromium found a framework gap that socketless/main-thread tests did not: an OrderDetail shipment include under the full Marble app shell exceeded a nested engine's 256 KiB script budget. Merely increasing the outer script budget did not fix it. Request workers now reserve an 8 MiB native stack, with a shared 4 MiB script budget that nested request engines may use from the remaining allowance. Non-request/service worker budgets are unchanged; minimum remaining stack and script-depth guards remain. A unit regression verifies that request script recursion fails with a script error rather than overflowing the worker. The full suite and authenticated browser smoke were rerun after this fix. See `plans/MarbleERPMigration.md` in MR-Moqui.

### Reproduce

See `test/README.md` for the isolated-runtime setup and commands. Test specs disable authz only around their features and restore it afterward; Chromium used the existing demo administrator with normal authorization enabled. The server is stopped after the smoke; this migration does not leave an app server running.

### Acceptance limits

Passing is not exhaustive role/organization isolation, CSRF, every business transition or every browser interaction. QVT was exercised on dashboard and order, not every mounted screen; organization select/clear was exercised in HTML. Wiki discovery exclusions still require page/space fixtures. Search-link expressions are tested against stored records, not a new exhaustive search-index/browser fixture. The upstream Marketing dashboard item has no mounted screen and remains unavailable. Physical check alignment, all external templates, FOP pagination parity, scanner hardware and production data upgrade behavior are not certified. Existing SimpleScreens acceptance limits still apply.
