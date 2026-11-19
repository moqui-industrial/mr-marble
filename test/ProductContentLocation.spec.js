// Catalog › Product › Content's New by Location (SimpleScreens/Catalog/Product/Content/ContentList.xml) makes a row through
// Mantle's create#ProductContent, so a name, description or download row naming a file outside the product's own content
// folder is refused (plans/Security-Review-Medium.md SEC-PSS-82: Shop published such a row's file); an image by location
// is still made. As john.doe. Run: ./moq test mr-marble --spec ProductContentLocation
const webroot = "component://webroot/screen/webroot.xml"
const PRODUCT = "SPEC_PCL_PRODUCT"
const path = "apps/marble/Catalog/Product/Content/ContentList/createContentWithLocation"
const outside = "component://mr-mantle/MoquiConf.xml"

function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
const rows = conditions => sys(() => Array.from(ec.entity.find("mantle.product.ProductContent").condition(conditions).useCache(false).list()))
function post(parameters) {
    const out = ec.screen.makeTest().rootScreen(webroot).render(path, Object.assign({productId: PRODUCT}, parameters), "post")
    const errors = Array.from(out.errorMessages || []).join(" | ")
    ec.message.clearErrors()
    return {status: out.status, errors}
}

spec({
    setupSpec() {
        login("john.doe")
        sys(() => ec.entity.makeValue("mantle.product.Product").setAll({productId: PRODUCT, productName: "Spec location product",
            productTypeEnumId: "PtAsset"}).create())
    },
    cleanup() {
        login("john.doe")
    }
})

feature("New by Location refuses a description row outside the product's folder and still makes an image row", {
    when() {
        login("john.doe")
        const description = post({productContentTypeEnumId: "PcntDescriptionLong", contentLocation: outside})
        const image = post({productContentTypeEnumId: "PcntImageSmall", contentLocation: "https://images.example.com/spec.png"})
        return {
            description,
            image,
            descriptionRows: rows({productId: PRODUCT, productContentTypeEnumId: "PcntDescriptionLong"}),
            imageRows: rows({productId: PRODUCT, productContentTypeEnumId: "PcntImageSmall"})
        }
    },
    then({description, image, descriptionRows, imageRows}) {
        description.errors.includes("a location is not taken")
        descriptionRows.length == 0
        image.errors == ""
        imageRows.length == 1
        imageRows[0].contentLocation == "https://images.example.com/spec.png"
    }
})
