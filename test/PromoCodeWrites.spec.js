// Marble's promotion code screens (screen/SimpleScreens/ProductStore/Promotion/PromoCode) write a code through Mantle's
// store#PromoCode, which keeps a code's text unique within its store's organization (the entity's own index is no longer
// unique; plans/archive/Security-Review.md SEC-BAP-108 review), and end one through expire#PromoCode. Run: ./moq test mr-marble --spec PromoCodeWrites
const root = "component://mr-marble/screen/SimpleScreens.xml"
const path = "ProductStore/Promotion/PromoCode/FindPromoCode/createPromoCode"
function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
const post = parameters => {
    const out = sys(() => ec.screen.makeTest().rootScreen(root).render(path, parameters, "post"))
    const errors = Array.from(out.errorMessages || []).join(" | ") + (ec.message.hasError() ? ec.message.getErrorsString() : "")
    ec.message.clearErrors()
    return errors
}
const count = text => sys(() => ec.entity.find("mantle.product.store.ProductStorePromoCode").condition("promoCode", text).count())

feature("a promotion code made on Marble's screen is unique within its store's organization", {
    when() {
        login("john.doe")
        const parameters = {productStoreId: "POPC_DEFAULT", storePromotionId: "PopcNewCustomer", promoCode: "SPECPCWTWICE", userEntered: "Y"}
        const first = post(parameters)
        const second = post(Object.assign({}, parameters, {promoCode: "specpcwtwice"}))
        return {first, second, made: count("SPECPCWTWICE") + count("specpcwtwice")}
    },
    then({first, second, made}) {
        first == ""
        second.includes("CODE_TAKEN")
        made == 1
    }
})
