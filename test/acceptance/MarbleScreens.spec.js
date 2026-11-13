// Marble's own shell/dashboard plus the SimpleScreens pages mounted under it.
let screens
let oldOrg

spec({
    dependsOn: ["AccountingActivities", "AssetReservationMultipleThreads", "OrderProcureToPayBasicFlow", "OrderToCashBasicFlow",
        "OrderToCashTime", "ReturnToResponseBasicFlow", "WorkPlanToCashBasicFlow", "RestApiTests"],
    setupSpec() {
        login("john.doe")
        oldOrg = ec.user.getPreference('ACTIVE_ORGANIZATION')
        screens = ec.screen.makeTest().rootScreen("component://mr-marble/screen/marble.xml")
    },
    setup() { ec.artifactExecution.disableAuthz() },
    cleanup() { ec.artifactExecution.enableAuthz() },
    cleanupSpec() {
        ec.user.setPreference('ACTIVE_ORGANIZATION', oldOrg)
        log.info(`Marble: ${screens.renderCount} renders, ${screens.errorCount} errors`)
    },
})

feature("dashboard renders native organization chooser (#orgId)", {
    where: [{ orgId: null }, { orgId: 'ORG_ZIZI_RETAIL' }],
    expect({ orgId }) {
        ec.user.setPreference('ACTIVE_ORGANIZATION', orgId)
        const result = screens.render('dashboard', {}, null)
        result.status == 200
        result.errorMessages.length == 0
        result.output.includes('Sales')
        result.output.includes('Requests')
        result.output.includes('Customers')
        result.output.includes('<details id="active-org-menu"')
        result.output.includes('preferenceValue=ORG_ZIZI_RETAIL')
        result.output.includes('Ziziwork Retail')
        !result.output.includes('?has_content')
        !result.output.includes('$("#navbar-buttons")')
        result.output.includes('Clear Active Organization') == (orgId != null)
    },
})

feature("all parameter-free mounted pages render", {
    expect() {
        ec.user.setPreference('ACTIVE_ORGANIZATION', null)
        const failed = []
        // These require wiki fixtures or a targeted date range (SalesSummary).
        const skip = ['wiki', 'ViewWikiPage', 'EditWikiPage', 'WikiCommentNested', 'WikiCommentReply', 'SalesSummary']
        for (const path of screens.getNoRequiredParameterPaths(skip)) {
            const result = screens.render(path, { lastStandalone: '-2' }, null)
            if (result.status != 200 || result.errorMessages.length || !result.output?.length)
                failed.push(`${path}: HTTP ${result.status}: ${result.errorMessages.join('; ')}`)
        }
        if (failed.length) log.warn(failed.join('\n'))
        failed.length == 0
    },
})

feature("populated mounted page (#path)", {
    where: [
        { path: 'Customer/FindCustomer?pseudoId=CustJqp', text: 'Joe' },
        { path: 'Supplier/FindSupplier?pseudoId=ZiddlemanInc', text: 'Ziddleman' },
        { path: 'Order/OrderDetail?orderId=55401', text: 'Picker Bot 2000' },
        { path: 'Accounting/Invoice/EditInvoice?invoiceId=55400', text: 'Payment Sent' },
        { path: 'Accounting/Payment/EditPayment?paymentId=55400', text: 'Delivered' },
        { path: 'Order/PrintOrder?orderId=55400&renderMode=xsl-fo', text: '$23,795.00' },
        { path: 'Accounting/Invoice/PrintInvoice?invoiceId=55400&renderMode=xsl-fo', text: 'Demo Product' },
        { path: `Accounting/Reports/SalesSummary?interval=y&intervalCount=2&vendorPartyIds=ORG_ZIZI_RETAIL&thruDate=${new Date().getUTCFullYear() + 1}-01-02`, text: 'Picker Bot 2000' },
    ],
    expect({ path, text }) {
        const result = screens.render(path, { lastStandalone: '-2' }, null)
        result.status == 200
        result.errorMessages.length == 0
        result.output.includes(text)
    },
})

feature("stored party search links test role membership (#roles)", {
    where: [
        { roles: null, customer: false, supplier: false },
        { roles: [], customer: false, supplier: false },
        { roles: [{roleTypeId: 'Customer'}], customer: true, supplier: false },
        { roles: [{roleTypeId: 'Supplier'}], customer: false, supplier: true },
        { roles: [{roleTypeId: 'Customer'}, {roleTypeId: 'Supplier'}], customer: true, supplier: true },
    ],
    expect({ roles, customer, supplier }) {
        const links = ec.entity.find('moqui.entity.document.DataDocumentLink')
            .condition({ dataDocumentId: 'MantleParty', linkSet: 'marble' }).list()
        links.length == 3
        const customerLink = links.find(link => link.linkSeqId == '42')
        const supplierLink = links.find(link => link.linkSeqId == '43')
        ec.resource.condition(customerLink.linkCondition, '', { roles }) == customer
        ec.resource.condition(supplierLink.linkCondition, '', { roles }) == supplier
    },
})

feature("stored wiki link expands with or without a page path (#pagePath)", {
    where: [{ pagePath: null, suffix: '/' }, { pagePath: 'Home', suffix: '/Home' }],
    expect({ pagePath, suffix }) {
        const link = ec.entity.find('moqui.entity.document.DataDocumentLink')
            .condition({ dataDocumentId: 'MantleWikiPage', linkSeqId: '41' }).one()
        ec.resource.expand(link.linkUrl, '', { wikiSpaceId: 'DEMO', pagePath }) == '/apps/marble/Wiki/wiki/DEMO' + suffix
    },
})
