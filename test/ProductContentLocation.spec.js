// Catalog › Product › Content's and Category › Content's New by Location make a row through Mantle's create#ProductContent and
// create#ProductCategoryContent, so a row of any type naming a file outside its record's own content folder is refused
// (plans/archive/Security-Review-Medium.md SEC-PSS-82, SEC-BAP-138), and the Download transitions stream only a file of that folder or
// an image (Content.js served): a row written outside it before is not streamed. As john.doe.
// Run: ./moq test mr-marble --spec ProductContentLocation
const webroot = "component://webroot/screen/webroot.xml"
const PRODUCT = "SPEC_PCL_PRODUCT"
const CATEGORY = "SPEC_PCL_CATEGORY"
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
function render(screenPath, parameters, method) {
    const out = ec.screen.makeTest().rootScreen(webroot).render(screenPath, parameters, method)
    const errors = Array.from(out.errorMessages || []).join(" | ")
    ec.message.clearErrors()
    return {status: out.status, errors, output: String(out.output || "")}
}
const post = parameters => render(path, Object.assign({productId: PRODUCT}, parameters), "post")

spec({
    setupSpec() {
        login("john.doe")
        sys(() => ec.entity.makeValue("mantle.product.Product").setAll({productId: PRODUCT, productName: "Spec location product",
            productTypeEnumId: "PtAsset"}).create())
        sys(() => ec.entity.makeValue("mantle.product.category.ProductCategory").setAll({productCategoryId: CATEGORY,
            categoryName: "Spec location category"}).create())
    },
    cleanup() {
        login("john.doe")
    }
})

feature("New by Location refuses a row of any type outside its record's folder; Download streams no such row's file (SEC-BAP-138)", {
    when() {
        login("john.doe")
        const description = post({productContentTypeEnumId: "PcntDescriptionLong", contentLocation: outside})
        const image = post({productContentTypeEnumId: "PcntImageSmall", contentLocation: "https://images.example.com/spec.png"})
        const category = render(
            "apps/marble/Catalog/Category/Content/ContentList/createContentWithLocation",
            {productCategoryId: CATEGORY, categoryContentTypeEnumId: "PcctDescription", contentLocation: outside},
            "post"
        )
        // a row written outside the folder before the rule, and a component's image as the demo data has one
        sys(() => {
            for (const [productContentId, contentLocation] of [
                ["SPEC_PCL_PLANTED", outside],
                ["SPEC_PCL_DEMO", "component://mr-marble/screen/ssstatic/images/Sales.png"]
            ])
                ec.entity
                    .makeValue("mantle.product.ProductContent")
                    .setAll({productContentId, productId: PRODUCT, productContentTypeEnumId: "PcntImageSmall", contentLocation})
                    .create()
        })
        const download = productContentId =>
            render("apps/marble/Catalog/Product/Content/ContentList/downloadContent", {productId: PRODUCT, productContentId}, "get")
        return {
            description,
            image,
            category,
            planted: download("SPEC_PCL_PLANTED"),
            demo: download("SPEC_PCL_DEMO"),
            // the detail screen reads no text of the planted row's file
            detail: render("apps/marble/Catalog/Product/Content/ContentDetail", {productId: PRODUCT, productContentId: "SPEC_PCL_PLANTED"}, "get"),
            descriptionRows: rows({productId: PRODUCT, productContentTypeEnumId: "PcntDescriptionLong"}),
            imageRows: rows({productId: PRODUCT, productContentTypeEnumId: "PcntImageSmall", contentLocation: "https://images.example.com/spec.png"}),
            categoryRows: sys(() =>
                Array.from(ec.entity.find("mantle.product.category.ProductCategoryContent").condition({productCategoryId: CATEGORY}).list())
            )
        }
    },
    then({description, image, category, planted, demo, detail, descriptionRows, imageRows, categoryRows}) {
        detail.status == 200 && !detail.output.includes("Error rendering") && !detail.output.includes("moqui-conf")
        detail.output.includes("SPEC_PCL_PLANTED")
        description.errors.includes("a location is not taken")
        descriptionRows.length == 0
        image.errors.includes("a location is not taken")
        imageRows.length == 0
        category.errors.includes("a location is not taken")
        categoryRows.length == 0
        planted.errors.includes("not in its record's content folder") && !planted.output.includes("moqui-conf")
        demo.errors == ""
    }
})
