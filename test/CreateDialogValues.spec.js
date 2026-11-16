// The create dialogs of two find screens take no value from the find's parameters (TUI review 2026-11-16): FindRequest's New
// Request keeps its Initial Status default (ReqSubmitted) when the find names a status, and FindProduct's New Product has an
// empty name when the find names one (their fields' from="null"). One qvt render of each, as the shell asks for it.
// Run: ./moq test mr-marble --spec CreateDialogValues
const webroot = "component://webroot/screen/webroot.xml"

spec({ setupSpec() { login("john.doe") } })

// the initial values of a form-single in a qvt render, as text
function initialOf(path, parameters, formName) {
    const str = ec.screen
        .makeTest()
        .rootScreen(webroot)
        .renderMode("qvt")
        .withStaticData()
        .render(path, Object.assign({lastStandalone: "true"}, parameters), null)
    ec.message.clearErrors()
    const output = String(str.output || "")
    const found = output.match(new RegExp(`<m-form name="${formName}"[^>]*:fields-initial="([^"]*)"`))
    return {status: str.status, errors: str.errorMessages.join(" | "), initial: found ? found[1] : ""}
}

feature("New Request's Initial Status and New Product's name are not the find's", {
    when() {
        return {
            request: initialOf("apps/marble/Request/FindRequest", {statusId: "ReqCompleted"}, "NewRequestForm"),
            product: initialOf("apps/marble/Catalog/Product/FindProduct", {productName: "SpecFindName"}, "NewProductForm")
        }
    },
    then({request, product}) {
        request.status == 200 && request.errors == ""
        request.initial.includes("'statusId':'ReqSubmitted'")
        !request.initial.includes("ReqCompleted")
        product.status == 200 && product.errors == ""
        product.initial.includes("'productName':''")
        !product.initial.includes("SpecFindName")
    }
})
