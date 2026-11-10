// Order to cash through the Marble ERP screens, as PopCommerce's jmeter/PopcOrderToCash.jmx did against PopcAdmin: log
// in, create a sales order, add items, place and approve it, print it, ship it, pick and pack the shipment, then pay the
// invoice that packing made. The same script runs against a Java Moqui with MarbleERP and against MR Moqui with
// mr-marble (plans/LoadRunner.md section 11), so the sample names line up in Compare.
//
// Run it against a server on its load test conf (conf/MoquiLoadTestConf.xml, tarpits off) with the demo data: the
// demo ALL_SCREENS tarpit answers 429 after 120 hits of a screen in 60 seconds.
//
// Every transition is posted with its parameters in the form (both servers refuse a transition POST with a query
// string) and followed, so a service error shows: a transition that fails answers a redirect back to its screen like
// one that works, and the error is only on the page it lands on.

plan({
    title: "Order to cash",
    description: "A sales order through Marble ERP's screens: create, place, approve, print, ship, pick, pack, invoice, pay",
    uses: ["http"],
    params: {
        appPath: { default: "/apps/marble", description: "The app's mount; /apps/PopcAdmin runs the walk on a Java server with PopCommerce" },
        user: { default: "john.doe", description: "The account every virtual user logs in as" },
        password: { default: "moqui", secret: true, description: "Its password" },
        customerPartyId: { default: "CustJqp", description: "The customer of each order" },
        vendorPartyId: { default: "ORG_ZIZI_RETAIL", description: "The selling organization" },
        facilityId: { default: "ZIRET_WH", description: "The warehouse the order ships from" },
        productId: { default: "DEMO_1_1", description: "The product of each item" },
        orderItems: { default: 3, description: "Product items an order (the same product, so they add to one item)" },
        quantity: { default: 10, description: "The quantity of each product item" },
        pdf: { default: true, description: "Get OrderDetail and PrintOrder as PDF; MR Moqui needs a Chromium for it" },
        logout: { default: false, description: "Log out at the end of each iteration; ends every session of the user, so only for a run with one user" },
    },
    thresholds: { errorRate: 0 },
})

// The top level runs in each user's engine when the script loads, and makes no request.

const app = String(params.appPath || "/apps/marble").replace(/\/+$/, "")
const orderItems = wholeNumber("orderItems", params.orderItems)
const quantity = wholeNumber("quantity", params.quantity)
const withPdf = flag(params.pdf)
const withLogout = flag(params.logout)

// The links OrderDetail and ShipmentDetail have to the shipment and the invoice of the walk.
const SHIPMENT_LINK = linkPattern("[Ss]hipmentDetail", "shipmentId")
const INVOICE_LINK = linkPattern("[Ee]ditInvoice", "invoiceId")

// The prices the JMeter script used: each product item at 18.99, and one shipping charge of 30.
const UNIT_AMOUNT = "18.99"
const SHIPPING_AMOUNT = "30"

// A hidden form that changes the invoice to Finalized: the StatusChangeSection link (template/basic/StatusWidgets.xml)
// to updateStatus, offered only while the invoice is In Process. Both servers render it as a form posting to
// .../EditInvoice/updateStatus with <input type="hidden" name="statusId" value="InvoiceFinalized">.
const FINALIZE_OFFERED = /<form\b[^>]*\baction="[^"]*\/updateStatus"[^>]*>(?:(?!<\/form>)[\s\S])*?name="statusId"\s+value="InvoiceFinalized"/

// An error or danger message on a page: Java's webroot apps.xml writes <div class="alert alert-danger fade in">, MR
// Moqui's includes/Messages.html.fancy writes <div class="alert" data-type="danger">.
const ALERT_DANGER = /<div class="alert(?: alert-danger[^"]*"|"\s+data-type="danger")[^>]*>([\s\S]*?)<\/div>/

scenario("sales", {
    users: 10, rampUp: 1, iterations: 5, pause: { gaussian: [200, 50] }, newSession: true,
    run(user, iteration) {
        step("order to cash", () => {
            login()
            screen("/dashboard", null, "dashboard")
            screen("/Order/FindOrder", null, "find orders")

            const created = transition(app + "/Order/FindOrder/createOrder", {
                customerPartyId: params.customerPartyId, vendorPartyId: params.vendorPartyId, facilityId: params.facilityId,
            }, "create order")
            const orderId = created.urlParam("orderId")
            if (!orderId) fail(`create order: no orderId in ${created.url}`)

            const orderDetail = app + "/Order/OrderDetail"
            for (let i = 0; i < orderItems; i++) {
                transition(orderDetail + "/addProductItem", {
                    orderId, orderPartSeqId: "01", productId: params.productId, quantity: String(quantity),
                    unitAmount: UNIT_AMOUNT, itemTypeEnumId: "ItemProduct",
                }, "add product item")
            }
            transition(orderDetail + "/createItem", {
                orderId, orderPartSeqId: "01", itemDescription: "Delivery Charge", quantity: "1", unitAmount: SHIPPING_AMOUNT,
                itemTypeEnumId: "ItemShipping",
            }, "add shipping charge")
            transition(orderDetail + "/placeOrder", { orderId }, "place order")
            transition(orderDetail + "/approveOrder", { orderId }, "approve order")

            if (withPdf) {
                pdf("/Order/OrderDetail", { orderId }, "order detail pdf")
                pdf("/Order/PrintOrder", { orderId }, "order pdf")
            }

            // OrderDetail's ShipmentLinks section: <link url="shipmentDetail" text="Shipment ${shipmentId}"/>, an
            // anchor to .../Shipment/ShipmentDetail?shipmentId=<id>.
            const shipped = transition(orderDetail + "/shipOrderPart", { orderId, orderPartSeqId: "01" }, "ship order")
            const shipmentId = linkedId(shipped.text, SHIPMENT_LINK)
            if (!shipmentId) fail(`ship order: no ShipmentDetail?shipmentId= link on the OrderDetail of order ${orderId}`)

            const shipmentDetail = app + "/Shipment/ShipmentDetail"
            screen("/Shipment/FindShipment", null, "find shipments")
            screen("/Shipment/ShipmentDetail", { shipmentId }, "shipment detail")
            transition(shipmentDetail + "/pickShipment", { shipmentId }, "pick shipment")
            transition(shipmentDetail + "/packItem", {
                shipmentId, productId: params.productId, quantity: String(quantity * orderItems),
            }, "pack item")
            // Packing an outgoing shipment makes its sales invoice (the ShipmentOutgoingPackedCreateInvoices SECA), linked
            // from ShipmentDetail's InvoiceLinks section: <link url="editInvoice" text="Invoice ${invoiceId}"/>.
            const packed = transition(shipmentDetail + "/packShipment", { shipmentId }, "pack shipment")
            const invoiceId = linkedId(packed.text, INVOICE_LINK)
            if (!invoiceId) fail(`pack shipment: no EditInvoice?invoiceId= link on ShipmentDetail of shipment ${shipmentId} (order ${orderId})`)

            const editInvoice = app + "/Accounting/Invoice/EditInvoice"
            screen("/Accounting/Invoice/FindInvoice", null, "find invoices")
            const invoice = screen("/Accounting/Invoice/EditInvoice", { invoiceId }, "invoice detail")
            // The pack invoice is already Finalized unless the shipping organization has salesInvoiceFinalizedAtShip
            // (MR Moqui only); then the page offers Finalize, and the step runs.
            if (FINALIZE_OFFERED.test(invoice.text)) {
                transition(editInvoice + "/updateStatus", { invoiceId, statusId: "InvoiceFinalized" }, "finalize invoice")
            }
            // the form's Effective Date, which a person fills: a Delivered payment without one is refused (Mantle's
            // PaymentCheckEffectiveDate SECA, on both servers)
            transition(editInvoice + "/recordPayment", { invoiceId, statusId: "PmntDelivered", effectiveDate: now() },
                "record payment")

            if (withLogout) http.post("/Login/logout", { name: "logout" })
        })
    },
})

// The login form's transition, on this iteration's new session. It needs no session token, and both servers send the
// new token in this response's headers, where the session takes it. A refused login redirects back to /Login.
function login() {
    const res = http.post("/Login/login", {
        form: { username: params.user, password: params.password }, csrf: false, name: "login", expect: [302, 303],
    })
    if (atLogin(res.location)) fail(`login: ${params.user} was refused (redirected to ${res.location})`)
    return res
}

// A GET of a screen of the app. With redirects off, a 302 (to /Login when the session ended) is an error.
function screen(path, query, name) {
    const opts = { name, expect: [200] }
    if (query) opts.params = query
    const res = http.get(app + path, opts)
    checkPage(res, name)
    return res
}

// A POST of a transition (its full path) with its parameters in the form, following its redirect to the screen it
// answers with.
function transition(path, form, name) {
    const res = http.post(path, { form, follow: true, name, expect: [200] })
    checkPage(res, name)
    return res
}

// A screen printed to PDF through /fop.
function pdf(path, query, name) {
    const res = http.get("/fop" + app + path, { params: query, name, expect: [200] })
    if (res.magic != "%PDF") fail(`${name}: not a PDF (${res.contentType || "no content type"}, starts ${JSON.stringify(res.magic)})`)
    return res
}

function checkPage(res, name) {
    if (atLogin(res.url)) fail(`${name}: landed on the login page (${res.url}); the session ended`)
    const error = pageError(res.text)
    if (error) fail(`${name}: ${error}`)
}

const AT_LOGIN = /\/Login(?:[/?#]|$)/
function atLogin(url) { return AT_LOGIN.test(url || "") }

// The text of the first error message on the page, or null.
function pageError(text) {
    const match = ALERT_DANGER.exec(text || "")
    if (!match) return null
    return match[1].replace(/<button[\s\S]*?<\/button>/, "").replace(/<[^>]+>/g, " ").replace(/&times;/g, "")
        .replace(/\s+/g, " ").trim() || "an error message with no text"
}

// The pattern of a parameter in a link to a screen, from an href that is absolute or relative and has the parameter
// first or after others (with & or &amp;): .../Shipment/ShipmentDetail?shipmentId=100050. Made once, at the top level.
function linkPattern(screenPattern, parameter) {
    return new RegExp(`/${screenPattern}\\?(?:[^"'\\s<>#]*?(?:&amp;|&))?${parameter}=([^&"'\\s<>#]+)`)
}

// The value of the parameter of a linkPattern in the first link it matches, or null.
function linkedId(text, pattern) {
    const match = pattern.exec(text || "")
    return match ? decodeURIComponent(match[1]) : null
}

// The time now as epoch milliseconds: both servers read a Timestamp from all-digit text as that (Java's
// L10nFacadeImpl.parseTimestamp, MR Moqui's moqui_lib::object::parse_timestamp), so neither reads it in a time zone.
function now() { return String(Date.now()) }

function wholeNumber(name, value) {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1) throw new Error(`the ${name} parameter must be a whole number of 1 or more, not ${JSON.stringify(value)}`)
    return n
}

function flag(value) { return value === true || String(value).toLowerCase() === "true" }
