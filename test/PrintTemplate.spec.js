// The print screens (Order/PrintOrder.xml, Accounting/Invoice/PrintInvoice.xml, Accounting/Payment/PaymentCheck.xml and
// PaymentDetail.xml, Shipment/ShipmentPick.xml, ShipmentPack.xml, ShipmentInsert.xml and ShipmentByPackage.xml) render
// their own template, or the one a store or organization setting names, never a templateLocation of the request, which
// rendered any component file as a template (plans/archive/Security-Review.md SEC-SCR-81). One html-print render of ShipmentInsert.
// Run: ./moq test mr-marble --spec PrintTemplate
const SHIPMENT = "SPEC_PRINT_SHP"
const COMPONENT_FILE = "component://mr-marble/test/README.md"
const COMPONENT_TEXT = "repository root with a current build"

function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
const shipment = () => sys(() => ec.entity.find("mantle.shipment.Shipment").condition("shipmentId", SHIPMENT).useCache(false).one())

spec({
    setupSpec() {
        login("john.doe")
        sys(() => {
            if (!shipment())
                ec.entity.makeValue("mantle.shipment.Shipment")
                    .setAll({shipmentId: SHIPMENT, shipmentTypeEnumId: "ShpTpSales", statusId: "ShipInput"})
                    .create()
        })
    },
    cleanupSpec() {
        sys(() => shipment()?.delete())
    }
})

feature("a print screen renders its own template, not a templateLocation of the request", {
    when() {
        const str = sys(() =>
            ec.screen.makeTest().rootScreen("component://mr-marble/screen/SimpleScreens.xml").renderMode("html-print")
                .render("Shipment/ShipmentInsert", {shipmentId: SHIPMENT, templateLocation: COMPONENT_FILE}, null)
        )
        const errors = Array.from(str.errorMessages || []).join(" | ")
        ec.message.clearErrors()
        return {status: str.status, errors, output: String(str.output || "")}
    },
    then({status, errors, output}) {
        status == 200
        errors == ""
        output.includes("print-ShipmentInsert")
        output.includes(SHIPMENT)
        !output.includes(COMPONENT_TEXT)
        !output.includes("Error rendering")
    }
})
