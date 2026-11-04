// Pages of the flow data as john.doe in headless Chromium, each with the text it must show, PrintOrder with its SVG
// barcode bars and a PDF, and the organization menu (select Ziziwork Retail, then clear it). Page problems (uncaught
// exceptions, console errors, failed responses, render errors) fail each row. The PDF goes to the output
// directory; reading the PDF's text (pdftotext) was a manual step and is not ported.
// Run: moqui test-client mr-marble --serve --spec BrowserSmoke
const user = params.user ?? "john.doe"
const password = params.password ?? "moqui"

// the REST login of the default session: the credentials work before any browser starts
spec({ setupSpec() { login(user, password) } })

// the pages of the flow data, each with the text it must show, on one page in turn
const pages = [
        { path: "/apps/SimpleScreens/Customer/FindCustomer?pseudoId=CustJqp", text: "Joe" },
        { path: "/apps/SimpleScreens/Order/OrderDetail?orderId=55401", text: "Picker Bot 2000" },
        { path: "/apps/SimpleScreens/Accounting/Invoice/EditInvoice?invoiceId=55400", text: "Payment Sent" },
        { path: "/apps/SimpleScreens/Accounting/Payment/EditPayment?paymentId=55400", text: "Delivered" },
        { path: "/apps/my/User/Account", text: "Change Password" },
]

feature("the flow data pages show their text", {
    expect() {
        const page = browser.newPage({ user, password })
        // each page that answered otherwise, lacks its text or shows a render error, named
        pages.map(({ path, text }) => {
            const status = page.goto(path).status
            const body = page.text()
            if (status != 200) return `${path}: status ${status}`
            if (!body.includes(text)) return `${path}: no "${text}"`
            if (/Error rendering section|Exception in render/.test(body)) return `${path}: a render error`
            return null
        }).filter((problem) => problem != null).join("; ") == ""
    },
})

feature("the organization menu selects and clears Ziziwork Retail", {
    expect() {
        const page = browser.newPage({ user, password })
        page.goto("/apps/marble/dashboard").status == 200
        // the shell moves the native details menu into the navbar
        page.locator("#navbar-buttons > #active-org-menu").count() == 1
        page.click("#active-org-menu summary")
        page.evaluate(() => document.querySelector("#active-org-menu").open) == true
        page.click('#active-org-menu a[href$="preferenceValue=ORG_ZIZI_RETAIL"]')
        page.waitFor(() => {
            const summary = document.querySelector("#active-org-menu summary")
            return summary && summary.innerText.includes("ZIRET")
        })
        page.click("#active-org-menu summary")
        page.click('#active-org-menu a[href$="preferenceValue="]')
        page.waitFor(() => {
            const summary = document.querySelector("#active-org-menu summary")
            const clear = document.querySelector('#active-org-menu a[href$="preferenceValue="]')
            return summary && summary.innerText.includes("Organization") && !clear
        })
    },
})

feature("PrintOrder renders barcodes and prints a PDF", {
    expect() {
        const page = browser.newPage({ user, password })
        page.goto("/apps/SimpleScreens/Order/PrintOrder.html-print?orderId=55400").status == 200
        page.text().includes("23,795.00")
        // real barcode SVG bars
        page.locator("svg rect").count() > 0
        const pdf = page.pdf("PrintOrder-55400")
        pdf.magic == "%PDF"
        pdf.size > 1000
    },
})
