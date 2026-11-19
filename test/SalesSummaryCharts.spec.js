// The Accounting Sales Summary report's charts load the framework's own Chart.js 4 (webroot libs) with Chart.js 4 options,
// never Chart.js 2.9.3 from a CDN with no integrity (plans/Security-Review.md SEC-BAP-137). One html render.
// Run: ./moq test mr-marble --spec SalesSummaryCharts
feature("Sales Summary renders its charts with the framework's Chart.js and its options", {
    when() {
        login("john.doe")
        const wasDisabled = ec.artifactExecution.disableAuthz()
        try {
            const rendered = ec.screen
                .makeTest()
                .rootScreen("component://mr-marble/screen/SimpleScreens.xml")
                .renderMode("html")
                .render("Accounting/Reports/SalesSummary", {organizationPartyId: "ORG_ZIZI_RETAIL"}, null)
            const errors = Array.from(rendered.errorMessages || []).join(" | ")
            ec.message.clearErrors()
            return {status: rendered.status, errors, output: String(rendered.output || "")}
        } finally {
            if (!wasDisabled) ec.artifactExecution.enableAuthz()
        }
    },
    then({status, errors, output}) {
        status == 200
        errors == ""
        output.includes("/libs/chartjs/chart.umd.min.js")
        !output.includes("cdnjs.cloudflare.com")
        !output.includes("yAxes") && !output.includes("xAxes")
    }
})
