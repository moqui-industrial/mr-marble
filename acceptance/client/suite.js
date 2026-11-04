// The browser sweep of mr-marble (./moq accept mr-marble): every Find screen in Chromium, against mr-mantle and this
// component with SimpleScreensRender (and the Mantle flows its dependsOn names) and ClientAccess of test/.
suite(["FindScreens"], {
    server: { components: ["mr-mantle", "mr-marble"], specs: ["SimpleScreensRender", "ClientAccess"] },
})
