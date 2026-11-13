// Port of the Playwright random-screen.spec.mjs (plans/archive/ClientTestHarness.md 9): each Find screen with a list and its
// Find Options dialog (a form-list with header-dialog="true") and no required parameter renders for john.doe in
// headless Chromium and fits the desktop viewport. The old test sampled one edited screen from git diff at random;
// here every candidate is a where row, so a failure repeats, and --param screen=Survey/FindSurvey runs one. Find
// screens exercise real forms without record-specific fixtures; their lists may be empty under the default filters,
// so this is a layout and framework smoke, not a check of rows. Page problems (uncaught exceptions, console errors,
// responses of 400 and up, render errors, error notifications) fail each row, and a failure leaves a screenshot in the
// output directory.
// Run: moqui test-client mr-marble --serve --spec FindScreens [--param screen=Order/FindOrder]
const user = params.user ?? "john.doe"
const password = params.password ?? "moqui"
const RENDER_ERRORS = /Error rendering|Exception in render|Internal Server Error|Maximum call stack|ReferenceError|TypeError/

// screen/SimpleScreens/<path>.xml with a header-dialog form-list and no required parameter
const candidates = files.list("screen/SimpleScreens", /\/Find[^/]+\.xml$/).filter((file) => {
    const xml = files.read(file)
    return /<form-list\b[^>]*header-dialog="true"/.test(xml) && !/<parameter\b[^>]*required="true"/.test(xml)
}).sort()
const rowOf = (file) => {
    const xml = files.read(file)
    const form = (xml.match(/<form-list\b[^>]*\bname="([^"]+)"/) || [])[1] || null
    const screen = file.replace(/^screen\/SimpleScreens\//, "").replace(/\.xml$/, "")
    return { screen, form, url: "/apps/" + file.replace(/^screen\//, "").replace(/\.xml$/, "") }
}
const named = params.screen == null ? null : String(params.screen).replace(/^screen\/SimpleScreens\//, "").replace(/\.xml$/, "")
const rows = named == null ? candidates.map(rowOf)
    : [candidates.includes(`screen/SimpleScreens/${named}.xml`) ? rowOf(`screen/SimpleScreens/${named}.xml`) : { screen: named, form: null, url: null }]

spec({})

feature("the candidate Find screens are found", {
    expect() {
        candidates.length > 0
        // --param screen names a candidate
        named == null || candidates.includes(`screen/SimpleScreens/${named}.xml`)
    },
})

feature("#screen renders its list and Find Options and fits the viewport", {
    where: rows,
    expect({ screen, form, url }) {
        form != null
        const page = browser.newPage({ user, password })
        page.goto(url).status == 200
        page.waitForURL(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:[?#]|$)"))
        !RENDER_ERRORS.test(page.text())
        const table = page.locator(`table[id^="${form}"]`)
        table.waitFor()
        table.locator("th").first().waitFor()
        page.getByRole("button", { name: /Find Options/ }).first().waitFor()
        // a broken desktop layout, without asking for pixel-identical output
        page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 2
        table.evaluate((el) => el.getBoundingClientRect().width) > 300
    },
})

// More non-mutating interaction on the Survey screen: New Survey opens with its fields and closes on Escape, and Find
// Options' Find submits the search.
feature("Survey: New Survey opens and closes, and Find Options' Find submits", {
    expect() {
        const page = browser.newPage({ user, password })
        page.goto("/apps/SimpleScreens/Survey/FindSurvey").status == 200
        const table = page.locator('table[id^="SurveyList"]')
        table.waitFor()
        page.getByRole("button", { name: /New Survey/ }).click()
        const dialog = page.locator("#NewSurveyContainer")
        dialog.waitFor()
        dialog.locator("[name=description]").isEditable()
        dialog.locator("[name=comments]").isEditable()
        dialog.getByRole("button", { name: /Create/ }).waitFor()
        const bounds = dialog.boundingBox()
        bounds.x >= 0
        bounds.x + bounds.width <= 1440
        page.keyboard.press("Escape")
        dialog.waitFor({ state: "hidden" })
        page.getByRole("button", { name: /Find Options/ }).first().click()
        page.getByRole("dialog").waitFor()
        page.getByRole("dialog").getByRole("button", { name: /Find/ }).click()
        table.waitFor()
        !/Error rendering|Exception in render|Internal Server Error/.test(page.text())
    },
})
