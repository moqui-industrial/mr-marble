// The acceptance client specs of mr-marble (./moq accept mr-marble): the browser sweep of every Find screen in
// Chromium, and the order to cash load script walked by two users once each (OrderToCash), against mr-mantle and this
// component with SimpleScreensRender (and the Mantle flows its dependsOn names) and ClientAccess of test/. The default
// conf keeps the demo data's tarpits, which two users' one iteration stays far under (120 hits of one screen in 60
// seconds); a real load run uses conf/MoquiLoadTestConf.xml, which this server does not, since SimpleScreensRender's
// Facility/PrintBoxTypes renders empty on it.
suite(["FindScreens", "OrderToCash"], {
    server: { components: ["mr-mantle", "mr-marble"], specs: ["SimpleScreensRender", "ClientAccess"] },
})
