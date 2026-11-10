// Port of PopCommerce's PopcAdminScreenTests.groovy, the test of these screens upstream (PopcAdmin mounts SimpleScreens):
// no-required-parameter screens except the exclusions below, then real demo/flow-data renders. The root is
// SimpleScreens.xml, so the paths are those under apps/PopcAdmin.
let screens, periodId

spec({
    // the whole MantleUslSuite ran before PopcAdminScreenTests: orders 55400 and 55401, invoices 55100 and 55400,
    // payment 55400, financial account 55700 and transaction 55700 come from these flows
    dependsOn: ["AccountingActivities", "AssetReservationMultipleThreads", "OrderProcureToPayBasicFlow", "OrderToCashBasicFlow",
        "OrderToCashTime", "ReturnToResponseBasicFlow", "WorkPlanToCashBasicFlow", "RestApiTests"],
    tempSequences: { start: 63100, banks: { "mantle.order.OrderHeader": 10, "mantle.work.effort.WorkEffort": 10 } },
    setupSpec() {
        login("john.doe")
        screens = ec.screen.makeTest().rootScreen("component://mr-marble/screen/SimpleScreens.xml")
        // the fiscal month of AccountingActivities' first transaction (55100): its id is sequenced, from whichever caller
        // first needed Retail's periods (a component's demo data may post for ORG_ZIZI_RETAIL when it loads)
        ec.artifactExecution.disableAuthz()
        const trans = ec.entity.find("mantle.ledger.transaction.AcctgTrans").condition("acctgTransId", "55100").one()
        periodId = call("mantle.ledger.LedgerServices.get#OrganizationFiscalTimePeriods", { organizationPartyId: "ORG_ZIZI_RETAIL",
                filterDate: trans.transactionDate, accountingDate: trans.accountingDate, timePeriodTypeId: "FiscalMonth" }).timePeriodList[0].timePeriodId
        ec.artifactExecution.enableAuthz()
    },
    cleanupSpec() {
        log.info(`Rendered ${screens.renderCount} screens (${screens.errorCount} errors) in ${(Date.now() - screens.startTime) / 1000}s, output ${Math.round(screens.renderTotalChars / 1000)}k chars`)
    },
    setup() { ec.artifactExecution.disableAuthz() },
    cleanup() { ec.artifactExecution.enableAuthz() },
})

feature("render Simple Screens with no required parameters", {
    expect() {
        // Wiki needs page/space fixtures; SalesSummary has a targeted data-backed render below.
        const screensToSkip = ['wiki', 'ViewWikiPage', 'EditWikiPage', 'WikiCommentNested', 'WikiCommentReply', 'SalesSummary']
        const failed = []
        for (const screenPath of screens.getNoRequiredParameterPaths(screensToSkip)) {
            const str = screens.render(screenPath, { lastStandalone: "-2" }, null)
            log.info(`Rendered ${screenPath} in ${str.renderTime}ms, ${str.output?.length} characters`)
            if (str.errorMessages.length || str.status != 200 || !str.output?.length)
                failed.push(`${screenPath}: HTTP ${str.status}, ${str.errorMessages.join('; ')}`)
        }
        if (failed.length) log.warn(`Screens with errors (${failed.length}):\n${failed.join('\n')}`)

        failed.length == 0
    },
})

feature("party autocomplete resolves the requested demo party, not unrelated rows", {
    where: [
        { screenPath: "Customer/FindCustomer/searchPartyList", partyId: "CustJqp", name: "Joe" },
        { screenPath: "Supplier/FindSupplier/searchPartyList", partyId: "ZiddlemanInc", name: "Ziddleman" },
    ],
    expect({ screenPath, partyId, name }) {
        const str = screens.render(screenPath, { term: partyId }, null)
        !str.errorMessages.length
        str.status == 200
        const rows = str.jsonObject
        Array.isArray(rows)
        rows.length == 1
        rows[0].value == partyId
        rows[0].label.includes(name)
    },
})

feature("render Simple Screens screen (#screenPath, #containsTextList)", {
    where: [
        // Search screens: use real demo parties, not an injected documentList.
        { screenPath: "Customer/FindCustomer?pseudoId=CustJqp", containsTextList: ['Joe', 'Public', 'Sales Orders'] },
        { screenPath: "Supplier/FindSupplier?pseudoId=ZiddlemanInc", containsTextList: ['Ziddleman', 'Purchase Orders'] },
        // Top products defaults to the previous complete period. January 2 stays in next year even west of UTC.
        { screenPath: `Accounting/Reports/SalesSummary?interval=y&intervalCount=2&vendorPartyIds=ORG_ZIZI_RETAIL&thruDate=${new Date().getUTCFullYear() + 1}-01-02`, containsTextList: ['Sales Summary', 'Ziziwork Retail', 'Top Products Ordered', 'Picker Bot 2000'] },
        // Supplier
        { screenPath: "Supplier/EditSupplier?partyId=ZiddlemanInc", containsTextList: ['Ziddleman &amp; Sons Suppliers', 'Supplier', '1-702-987-6543', '1350 E. Flamingo Rd. #9876'] },
        // Customer
        { screenPath: "Customer/EditCustomer?partyId=CustJqp", containsTextList: ['Joe', 'joe@public.com', 'Visa ************1111', '1-702-234-5678', '1350 E. Flamingo Rd. #2345'] },
        // Party
        { screenPath: "Party/EditParty?partyId=EX_JOHN_DOE", containsTextList: ['john.doe@moqui.org', 'John'] },
        { screenPath: "Party/PartyEmails?partyId=CustJqp", containsTextList: ['joe@public.com', 'Order Placed'] },
        { screenPath: "Party/FinancialInfo?partyId=CustJqp", containsTextList: ['ZIRET', 'Invoice Payment', 'Placed', 'Payment Received'] },
        { screenPath: "Party/PaymentMethod/EditPaymentMethod?partyId=CustJqp&paymentMethodId=CustJqpCc", containsTextList: ['1111', 'Visa',
            ...Array.from({length: 10}, (_, i) => `value="${new Date().getFullYear() + i}"`)] },
        // Catalog
        { screenPath: "Catalog/Category/EditCategory?productCategoryId=DEMO_ONE", containsTextList: ['Demo Category One'] },
        { screenPath: "Catalog/Category/EditProducts?productCategoryId=DEMO_ONE", containsTextList: ['Demo Product One-One', 'Asset (Good)'] },
        { screenPath: "Catalog/Product/EditProduct?productId=DEMO_1_1", containsTextList: ['Demo Product One-One', 'Shipping Weight'] },
        { screenPath: "Catalog/Product/EditCategories?productId=DEMO_1_1", containsTextList: ['Demo Category One', 'Catalog'] },
        { screenPath: "Catalog/Product/EditAssocs?productId=DEMO_1_1", containsTextList: [] },
        { screenPath: "Catalog/Product/EditPrices?productId=DEMO_1_1", containsTextList: ['ZiddlemanInc', '16.99'] },
        // Order
        { screenPath: "Order/OrderDetail?orderId=55400", containsTextList: ['$23,795.00', 'Shipment 55400', 'Demo Product One-One'] }, // Purchase Order
        { screenPath: "Order/PrintOrder?orderId=55400&renderMode=xsl-fo", containsTextList: ['Ziziwork Retail', 'Demo Product', '$23,795.00'] },
        { screenPath: "Order/OrderDetail?orderId=55401", containsTextList: ['$9,000.00', 'Shipment 55401', 'Picker Bot 2000'] }, // Sales Order
        // Shipment
        { screenPath: "Shipment/ShipmentDetail?shipmentId=55400", containsTextList: ['Invoice 55400', 'Demo Product One-One'] }, // Incoming Shipment
        { screenPath: "Shipment/ShipmentDetail?shipmentId=55401", containsTextList: ['Order 55401', 'Picker Bot 2000'] }, // Outgoing Shipment
        // Facility
        { screenPath: "Facility/EditFacility?facilityId=ZIRET_WH", containsTextList: ['Ziziwork Retail Warehouse', '51 W. Center St.'] },
        { screenPath: "Facility/EditFacilityLocations?facilityId=ZIRET_WH", containsTextList: [] },
        { screenPath: "Facility/FacilityCalendar?facilityId=ZIRET_WH", containsTextList: [] },
        // Asset
        { screenPath: "Asset/Asset/AssetDetail?assetId=55400", containsTextList: ['DEMO_1_1', 'ORG_ZIZI_RETAIL', 'Available'] },
        { screenPath: "Asset/Asset/AssetCalendar?assetId=55400", containsTextList: [] },
        // Accounting/Invoice
        { screenPath: "Accounting/Invoice/FindInvoice?statusId_op=in&statusId=InvoiceReceived,InvoiceApproved&toPartyId=ORG_ZIZI_RETAIL", containsTextList: ['Ziddleman', 'Ziziwork Retail', 'Sales/Purchase'] },
        { screenPath: "Accounting/Invoice/EditInvoice?invoiceId=55100", containsTextList: ['Approved', 'Unpaid $1,824.25', 'ORG_ZIZI_RETAIL'] },
        { screenPath: "Accounting/Invoice/EditInvoice?invoiceId=55400", containsTextList: ['ZIRET: Ziziwork Retail', 'Payment Sent', 'Applied Payments $23,830.00'] }, // fully paid: no payment dialogs, so no ORG_ZIZI_RETAIL from their GL account lists
        { screenPath: "Accounting/Invoice/EditInvoiceItems?invoiceId=55400", containsTextList: ['Demo Product One-One', 'Shipping and Handling'] },
        { screenPath: "Accounting/Invoice/PrintInvoice?invoiceId=55400&renderMode=xsl-fo", containsTextList: ['1350 E. Flamingo Rd. #9876, Las Vegas, NV 89119-5263', 'Asset - Inventory'] },
        // Accounting/Payment
        { screenPath: "Accounting/Payment/EditPayment?paymentId=55400", containsTextList: ['ORG_ZIZI_RETAIL', 'Applied $24,000.00', 'Delivered'] },
        { screenPath: "Accounting/Payment/PaymentCheck?paymentIds=55400&renderMode=xsl-fo", containsTextList: ['Ziddleman', 'Twenty four thousand and 00/100', 'Picker Bot 2000'] },
        { screenPath: "Accounting/Payment/PaymentDetail?paymentIds=55400&renderMode=xsl-fo", containsTextList: ['Ziddleman', '$23,830.00', 'Picker Bot 2000'] },
        // Accounting Other
        { screenPath: "Accounting/FinancialAccount/EditFinancialAccount?finAccountId=55700", containsTextList: ['Ziziwork Retail', 'Joe Public', 'Active'] },
        { screenPath: "Accounting/FinancialAccount/FinancialAccountTrans?finAccountId=55700", containsTextList: ['Customer Service Credit', 'Ziziwork Retail '] },
        { screenPath: "Accounting/Transaction/EditTransaction?acctgTransId=55700", containsTextList: ['Joe Public', '430000000', 'Customer Service Credits'] },
        { screenPath: "Accounting/GlAccount/EditGlAccount?glAccountId=110000000", containsTextList: ['Cash and Equivalent Asset', 'Ziziwork Industries'] },
        { screenPath: "Accounting/OrgSettings/AcctgPreference?partyId=ORG_ZIZI_RETAIL", containsTextList: ['Ziziwork Industries', 'Clone Accounting Settings'] },
        // Accounting/Reports
        // NOTE: these are designed to handle account masks of ###-###-### or even down to the 5 digit ###-##
        { screenPath: "Accounting/Reports/BalanceSheet?organizationPartyId=ORG_ZIZI_RETAIL&timePeriodIdList=PERIOD&detail=true", containsTextList: ["Finished Good Inventory", "212-00", "saveFilename=BalanceSheet.csv"] },
        { screenPath: "Accounting/Reports/IncomeStatement?organizationPartyId=ORG_ZIZI_RETAIL&timePeriodIdList=PERIOD&detail=true", containsTextList: ["Product Sales", "614-20"] },
        { screenPath: "Accounting/Reports/CashFlowStatement?organizationPartyId=ORG_ZIZI_RETAIL&timePeriodIdList=PERIOD&detail=true", containsTextList: ["Finished Good Inventory", "111-10"] },
        { screenPath: "Accounting/Reports/RetainedEarningsStatement?organizationPartyId=ORG_ZIZI_RETAIL&timePeriodIdList=PERIOD", containsTextList: ["Net Earnings", "ZIRET F"] },
        { screenPath: "Accounting/Reports/FinancialRatios?organizationPartyId=ORG_ZIZI_RETAIL&timePeriodIdList=PERIOD", containsTextList: ["Total Assets", "Accounts Receivable"] },
        { screenPath: "Accounting/Reports/PostedAmountSummary?organizationPartyId=ORG_ZIZI_RETAIL&dateRange_poffset=0&dateRange_period=Year", containsTextList: ["Accounts Payable", "Depreciation - Equipment"] },
        { screenPath: "Accounting/Reports/PostedBalanceSummary?organizationPartyId=ORG_ZIZI_RETAIL&timePeriodId=PERIOD", containsTextList: ["Customer Service Credits (Discounts and Write-downs)", "Net Income"] },
        // a class and its descendants (a Set of enum ids made a find that failed); a lateral sub-select member needs a selected field
        { screenPath: "Accounting/Reports/AccountBalance?organizationPartyId=ORG_ZIZI_RETAIL&timePeriodTypeId=FiscalMonth&classAndDescendants=GEN_ADMIN_EXPENSE", containsTextList: ["Utilities - Heating", "Utilities Expense"] },
        { screenPath: "Accounting/Reports/InvoiceReconciliation?organizationPartyId=ORG_ZIZI_RETAIL&timePeriodId=PERIOD", containsTextList: ["Aging - GL Difference", "Receivable Aging Unpaid", "Invoices where Unpaid different from GL Amount"] },
        // Vendor
        { screenPath: "Party/EditParty?partyId=ORG_ZIZI_RETAIL", containsTextList: ['Ziziwork Retail', 'Internal', 'payment.biziwork.retail@test.com'] },
    ],
    expect({ screenPath, containsTextList }) {
        const str = screens.render(screenPath.replace("=PERIOD", "=" + periodId), { lastStandalone: "-2" }, null)
        let containsAll = true
        for (const containsText of containsTextList) {
            if (containsText && !str.assertContains(containsText)) {
                log.info(`In ${screenPath} text [${containsText}] not found:\n${str.output}`)
                containsAll = false
            }
        }

        !str.errorMessages.length
        str.status == 200
        str.output.length > 0
        containsAll
    },
})

// The wiki screens over a space made here: a page with two versions, viewed by version and compared. The compare is
// the server-side diff (ResourceReference.getVersionDiff), a moqui-diff table, where the Java screen ran jsdiff.
feature("wiki page versions render: #screenPath", {
    given() {
        if (!ec.entity.find("moqui.resource.wiki.WikiSpace").condition("wikiSpaceId", "SSWT").one()) {
            call("org.moqui.resource.WikiServices.create#WikiSpace", { wikiSpaceId: "SSWT", description: "Screen test space" })
            for (const pageText of ["first text of the page\n", "second text of the page\n"])
                call("org.moqui.resource.WikiServices.update#WikiPage", { wikiSpaceId: "SSWT", pageName: "Page1", pageText })
        }
    },
    where: [
        { screenPath: "Wiki/wiki/SSWT/Page1", containsText: "second text" },
        { screenPath: "Wiki/wiki/SSWT/Page1?versionName=01", containsText: "first text" },
        { screenPath: "Wiki/ViewWikiPage?wikiSpaceId=SSWT&pagePath=Page1&versionName=01", containsText: "first text" },
        { screenPath: "Wiki/WikiCompare?wikiSpaceId=SSWT&pagePath=Page1&versionNameLhs=01&versionNameRhs=02", containsText: "moqui-diff" },
        { screenPath: "Wiki/EditWikiPage?wikiSpaceId=SSWT&pagePath=Page1", containsText: "second text" },
    ],
    expect({ screenPath, containsText }) {
        const str = screens.render(screenPath, { lastStandalone: "-2" }, null)
        if (!str.output?.includes(containsText)) log.info(`In ${screenPath} text [${containsText}] not found:\n${str.output}`)
        !str.errorMessages.length
        str.status == 200
        str.output.includes(containsText)
    },
})

// getOrgFiscalPeriods feeds the time period drop-downs (Budget, FindBudget): plain maps with the value and label fields (entity
// values did not serialize, a label read "<object>"), and the drop-down's current value as term gives that period alone.
feature("fiscal period drop-down options are plain maps, a term picks its period", {
    expect() {
        const all = screens.render("Accounting/Budget/FindBudget/getOrgFiscalPeriods",
                { organizationPartyId: "ORG_ZIZI_RETAIL", timePeriodTypeId: "FiscalMonth", lastStandalone: "-2" }, null)
        !all.errorMessages.length
        const rows = all.jsonObject
        Array.isArray(rows)
        rows.length > 1
        rows.every(row => typeof row == "object" && row.timePeriodId && row.periodName)
        const one = screens.render("Accounting/Budget/FindBudget/getOrgFiscalPeriods",
                { organizationPartyId: "ORG_ZIZI_RETAIL", timePeriodTypeId: "FiscalMonth", term: periodId, lastStandalone: "-2" }, null)
        one.jsonObject.length == 1
        one.jsonObject[0].timePeriodId == periodId
        one.jsonObject[0].periodName == rows.find(row => row.timePeriodId == periodId).periodName
    },
})

// A set value with ## and no ${} went through the l10n comment strip: the price format "#,##0.000" read "#,".
feature("getProductPrice formats the price to three decimals by default", {
    expect() {
        const str = screens.render("Order/OrderItems/getProductPrice",
                { productId: "DEMO_1_1", quantity: "1", pricePurposeEnumId: "PppPurchase", lastStandalone: "-2" }, null)
        !str.errorMessages.length
        /^\d[\d,]*\.\d{3}$/.test(String(str.output).trim())
    },
})

// The return item list posts the hidden "" of a replacement product it does not change; an id field set to "" failed its foreign key.
feature("a return item update with a blank replacement product clears it, not a foreign key error", {
    expect() {
        const out = ec.service.sync().name("mantle.order.ReturnServices.update#ReturnItem")
                .parameters({ returnId: "55700", returnItemSeqId: "01", replacementProductId: "", description: "blank replacement" }).call()
        !ec.message.hasError()
        ec.entity.find("mantle.order.return.ReturnItem").condition("returnId", "55700").condition("returnItemSeqId", "01").one().replacementProductId == null
    },
})
