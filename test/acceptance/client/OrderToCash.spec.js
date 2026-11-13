// The order to cash load script (test/load/OrderToCash.load.js, plans/archive/LoadRunner.md section 14) still walks its flow:
// two users, one iteration each, against the suite's server (suite.js: the default conf, whose demo tarpits two users'
// one iteration stays far under). No errors, each step's name has two samples, and the two orders it made, with their
// shipments and invoices, are in their final statuses, read over Mantle's REST API. A complete scenario well over the
// regression budget, so an acceptance test.
// Run: ./moq accept mr-marble --spec OrderToCash
const user = params.user ?? "john.doe"
const password = params.password ?? "moqui"

// The steps of one iteration with pdf=false (the PDFs need a Chromium on the server); finalize invoice runs only when
// the invoice is still In Process.
const STEPS = ["login", "dashboard", "find orders", "create order", "add shipping charge", "place order",
    "approve order", "ship order", "find shipments", "shipment detail", "pick shipment", "pack item", "pack shipment",
    "find invoices", "invoice detail", "record payment", "order to cash"]

spec({
    // the suite's server has the demo data: no login there is a failure, not a skip
    setupSpec() { login(user, password) },
})

// Mantle's REST API, as the spec's user.
const api = (path, query) => http.get("/rest/s1/mantle" + path, { params: query, accept: "json", expect: [200] }).json()
const unique = (ids) => [...new Set(ids)]

feature("two users walk order to cash once each", {
    when() {
        const started = Date.now()
        const stats = load({
            script: "test/load/OrderToCash.load.js", params: { pdf: false, user, password },
            scenarios: { sales: { users: 2, iterations: 1 } },
        })
        // the orders entered since the load started: no other run uses this server
        const made = unique(api("/orders", { customerPartyId: "CustJqp", entryDate_from: started, pageSize: 50 })
            .map((order) => order.orderId))
        const orders = made.map((orderId) => api(`/orders/${orderId}`))
        // the product item is item 01; its billings have a row per asset issuance, so the ids repeat
        const shipmentIds = unique(made.flatMap((orderId) => api(`/orders/${orderId}/items/01/shipments`))
            .map((source) => source.shipmentId))
        const invoiceIds = unique(made.flatMap((orderId) => api(`/orders/${orderId}/items/01/billings`))
            .map((billing) => billing.invoiceId))
        const shipments = shipmentIds.map((shipmentId) => api(`/shipments/${shipmentId}`))
        const invoices = invoiceIds.map((invoiceId) => api(`/invoices/${invoiceId}`))
        return { stats, made, orders, shipments, invoices }
    },
    then({ stats, made, orders, shipments, invoices }) {
        stats.errors == 0
        stats.passed
        STEPS.filter((name) => stats.names[name] == null || stats.names[name].count != 2).length == 0
        stats.names["add product item"].count == 6
        made.length == 2
        // packed and paid; the order is complete once all of it is packed
        orders.every((order) => order.statusId == "OrderCompleted")
        shipments.length == 2
        shipments.every((shipment) => shipment.statusId == "ShipPacked")
        invoices.length == 2
        invoices.every((invoice) => invoice.statusId == "InvoicePmtRecvd")
    },
})
