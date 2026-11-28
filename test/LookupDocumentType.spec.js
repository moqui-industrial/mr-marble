// Marble's party and product lookups (template/party/PartyForms.xml searchPartyList, template/product/ProductTransitions.xml
// getProductList) search the app's own party and product documents, never a document type a request names
// (plans/archive/Security-Review-Medium.md SEC-DAT-81: a request's documentType searched any store, each answer a yes or no):
// a party lookup asked for products answers parties, a product lookup asked for parties answers products. As john.doe,
// after the data feed has indexed the demo data. Run: ./moq test mr-marble --spec LookupDocumentType
const webroot = "component://webroot/screen/webroot.xml"

function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
const exists = (entity, fields) => sys(() => !!ec.entity.find(entity).condition(fields).useCache(false).one())
// the lookup's JSON answer: [{value, label}]
function lookup(path, parameters) {
    const out = ec.screen.makeTest().rootScreen(webroot).render(path, parameters, "get")
    ec.message.clearErrors()
    const text = String(out.output || "").trim()
    try {
        const json = JSON.parse(text)
        return Array.isArray(json) ? json : json.options || []
    } catch (error) {
        return [{value: "unparsed", label: text.substring(0, 200)}]
    }
}

spec({
    setupSpec() {
        login("john.doe")
        sys(() => ec.service.sync().name("org.moqui.EntityServices.process#DataFeedPending").call())
    },
    cleanup() {
        login("john.doe")
    }
})

feature("a party lookup answers parties and a product lookup products, whatever documentType the request names", {
    when() {
        login("john.doe")
        const products = lookup("apps/marble/Asset/Asset/FindSummary/getProductList", {term: "Demo"})
        const parties = lookup("apps/marble/Asset/Asset/FindSummary/searchPartyList", {term: "Ziziwork"})
        const partiesAsProducts = lookup("apps/marble/Asset/Asset/FindSummary/searchPartyList", {term: "Demo", documentType: "MantleProduct"})
        const productsAsParties = lookup("apps/marble/Asset/Asset/FindSummary/getProductList", {term: "Ziziwork", documentType: "MantleParty"})
        return {products, parties, partiesAsProducts, productsAsParties}
    },
    then({products, parties, partiesAsProducts, productsAsParties}) {
        // what each lookup finds when asked plainly
        products.some(option => exists("mantle.product.Product", {productId: option.value}))
        parties.some(option => exists("mantle.party.Party", {partyId: option.value}))
        // and asked for another type, still only its own
        partiesAsProducts.every(option => exists("mantle.party.Party", {partyId: option.value}))
        productsAsParties.every(option => exists("mantle.product.Product", {productId: option.value}))
    }
})

// Quick Search's type choice is the types the general search takes (SEC-DAT-81): no messages or wiki pages. Its one
// render in the regression suite, html.
feature("Quick Search offers the general search's types, not messages or wiki pages", {
    when() {
        login("john.doe")
        const out = ec.screen.makeTest().rootScreen(webroot).renderMode("html").render("apps/marble/QuickSearch", {}, "get")
        ec.message.clearErrors()
        return {status: out.status, output: String(out.output || "")}
    },
    then({output}) {
        !output.includes("Error rendering") && !output.includes("Exception in render")
        output.includes('value="MantleParty"')
        !output.includes('value="MantleCommunicationEvent"')
        !output.includes('value="MantleWikiPage"')
    }
})
