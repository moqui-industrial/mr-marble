# mr-marble tests

Run from the MR Moqui repository root with a current build. `test/` is the regression suite, run while working and in
`./moq test-apps` before a commit; `acceptance/` is the acceptance suite, the screen sweeps, run with `./moq accept`
on a schedule, before a release, when asked, or after adding or changing one of its specs (the two suites:
`docs/Build-Test.md` in MR Moqui). Select both `mr-mantle` and `mr-marble`: the screen specs depend on eight Mantle
flow specs (AccountingActivities, AssetReservationMultipleThreads, OrderProcureToPayBasicFlow, OrderToCashBasicFlow, OrderToCashTime, ReturnToResponseBasicFlow, WorkPlanToCashBasicFlow and RestApiTests), which supply
the pinned orders 55400/55401, invoices 55100/55400/55900, financial accounts and worker credentials the screens
assert. Do not remove a dependency without replacing its fixtures.

```sh
moqui test mr-mantle mr-marble --keep --junit <dir>                       # the regression suite on a fresh fixture
./moq test mr-marble --spec OrderRoleFilters
./moq test mr-marble --spec ScreenReport -D mrss_screen_report=<file.md>
./moq accept mr-mantle mr-marble                                          # the acceptance suite: the sweeps
moqui test mr-mantle mr-marble --acceptance --spec MarbleScreens          # one sweep and its flow specs
```

**Do not use `--db existing` against valuable data**: specs create orders, payments, messages, tasks, time entries and
authentication factors, and re-running fixture specs in a used database collides on IDs. To test outside the default
runtime, set `MOQUI_RUNTIME` to a directory with `conf/`, a `base-component` link and `component/` links to mr-mantle
and mr-marble.

## Server specs

The acceptance suite (`acceptance/`) holds the screen sweeps:

- `MyAccountScreens`: worker renders and real message, event, task and time-entry transitions; single-use
  authentication codes.
- `SimpleScreensRender`: every parameter-free screen, then populated customer, supplier, party, catalog, order,
  shipment, asset, invoice, payment, financial-account and financial-report screens; search and autocomplete JSON;
  SalesSummary over flow data (dated January 2 of next year so this year's orders count in any time zone). Print
  content is checked through the legacy `renderMode=xsl-fo` alias and the HTML-print replacements.
- `MarbleScreens`: the Marble ERP dashboard and organization chooser, every parameter-free mounted page, and populated
  pages. Tests restore the user's active-organization preference.
- `GitScreens`: the git screens of projects and tasks, My Account's Git Access and the tools repository detail (needs
  the `git` feature).

The regression suite (`test/`):

- `ProjectSummarySource`: `Project/ProjectSummary.xml` shows its percents and budgets as numbers.
- `ClientAccess`: the **test-only** grant the client specs' server needs (below).
- `OrderRoleFilters`: evaluates `FindOrder.xml`'s two OrgInternal `econdition ignore` expressions for ten `orderType`
  values against Java's case-insensitive sales/purchase behavior.
- `ScreenReport`: lists every screen with whether a sweep, a targeted spec or the browser smoke reaches it, and its
  companion files; ignored unless `mrss_screen_report` names the file. The checklist in `../MIGRATION-STATUS.md` is
  ticked by hand.

Tests disable authz around features. Passing does not establish production authorization, organization isolation,
CSRF enforcement, every browser interaction or physical printing.

## Client specs

`test/client/` holds specs that run outside the server against a running one, in headless Chromium
(`docs/dev/Client-Testing.md` in MR Moqui). `--serve` starts the server `test/client/suite.js` declares, runs the specs
and stops it:

```sh
moqui test-client mr-marble --serve                     # the regression suite: BrowserSmoke
moqui test-client mr-marble --serve --acceptance --spec FindScreens --param screen=Order/FindOrder --headed
```

The server is a child `moqui test mr-mantle mr-marble --spec <the eight Mantle flows>,ClientAccess --db snapshot
--serve` on a scratch runtime (the acceptance suite's adds SimpleScreensRender). `ClientAccess.spec.js` grants john.doe's ADMIN group the app, and `test/MoquiConf.xml` mounts it at
`/apps/SimpleScreens`; both merge into `moqui test` runs only, never into `data/` or the component's conf. Against a
server of your own with disposable data, load that grant there (`moqui test mr-marble --spec ClientAccess --db
existing`) and pass `--server <url>`; `--param user=` and `--param password=` override the local demo credentials.

- `BrowserSmoke` (the regression suite's one walk): customer, order, invoice, payment and My Account pages; the
  organization menu (select Ziziwork Retail, then clear it); PrintOrder 55400 with its SVG barcode and a PDF. It changes
  the demo user's active organization, so use disposable data.
- `FindScreens` (in `acceptance/client/`): a row for every `Find*.xml` with a list, Find Options and no required
  parameter (or the one `--param screen=` names), checking the page, the list and overflow. It is a layout smoke, not a
  check of rows.

Every row fails on page problems (uncaught exceptions, console errors, HTTP 400 and up, render errors), leaving
`failed-<feature>-<n>.png` and `.txt`. Output goes to `runtime/tmp/test-client/<time>-<pid>/` or `--out <dir>`. With no
Chromium found the browser features skip; `--fail-on-skip` makes that a failure for CI.

## Load script

`test/load/OrderToCash.load.js` walks a sales order through the Marble ERP screens (create, place, approve, print, ship,
pick, pack, pay), the same walk on MR Moqui and on a Java MarbleERP so the results compare (`docs/tools/Load-Runner.md` in MR
Moqui; the walk is section 11 of its `plans/archive/LoadRunner.md`). Run it against a server on `conf/MoquiLoadTestConf.xml` with the demo data:

```sh
./moq run -c conf/MoquiLoadTestConf.xml -p 8090                         # in another terminal
./moq test-load mr-marble --script OrderToCash -p 8090 [--param pdf=false] [--users 10 --iterations 5]
moqui test-load --compare <java>/result.json <mr>/result.json
```

The acceptance spec `acceptance/client/OrderToCash.spec.js` runs it with two users once each and checks the orders,
shipments and invoices it made.

## Lint

```sh
moqui lint --groovy runtime/component/mr-marble
moqui lint --screens <report.txt>
```
