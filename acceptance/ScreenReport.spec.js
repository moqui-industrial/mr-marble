// Port of screen-report.py: a Markdown report of every screen XML under screen/ and the testing that reaches it, for
// the agent or reviewer choosing work. MIGRATION-STATUS.md keeps only the Migrated/Validated checklist, which a person
// or agent ticks by hand. Ignored unless the property mrss_screen_report names the file to write:
//     ./moq test mr-marble --spec ScreenReport -D mrss_screen_report=/tmp/mrss-report.md
//
// Columns: Discovery (one of the no-required-parameter paths SimpleScreensRender renders; "excluded" for a screen it
// skips), Targeted (the path appears in the server specs; a text match, so it can over-credit a screen named inside a
// longer path), Smoke (in test/client/BrowserSmoke.spec.js), Companion files (the .fancy templates
// beside the screen). The discovery list comes from screens.getNoRequiredParameterPaths, as SimpleScreensRender gets it;
// the screen files are a listing of the component's screen directory (it was git ls-files).
const OUT = System.getProperty("mrss_screen_report")
// as SimpleScreensRender skips them
const SKIP = ["wiki", "ViewWikiPage", "EditWikiPage", "WikiCommentNested", "WikiCommentReply", "SalesSummary"]
const COMPONENT = "component://mr-marble"

// Every file under location, as paths relative to the component ("screen/SimpleScreens/Order/FindOrder.xml").
const listFiles = (location, prefix, out) => {
    for (const ref of ec.resource.getLocationReference(location).getDirectoryEntries()) {
        const name = ref.location.substring(ref.location.lastIndexOf("/") + 1)
        if (ref.isDirectory()) listFiles(ref.location, `${prefix}${name}/`, out)
        else out.push(prefix + name)
    }
    return out
}
const textOf = (path) => String(ec.resource.getLocationText(`${COMPONENT}/${path}`) || "")
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

let screens

spec({
    setupSpec() {
        if (!OUT) return
        login("john.doe")
        screens = ec.screen.makeTest().rootScreen("component://mr-marble/screen/SimpleScreens.xml")
    },
})

feature("the screen report is written", {
    ignore: OUT ? undefined : "set -D mrss_screen_report=<file> to write the screen report",
    when() {
        const discovery = new Set(screens.getNoRequiredParameterPaths(SKIP).map((path) => String(path).trim()))
        const files = listFiles(`${COMPONENT}/screen`, "screen/", []).sort()
        // the specs of both suites: the sweeps that reach most screens are acceptance tests
        const specNames = listFiles(`${COMPONENT}/test`, "test/", []).concat(listFiles(`${COMPONENT}/acceptance`, "acceptance/", []))
            .filter((path) => /^(test|acceptance)\/[^/]+\.spec\.js$/.test(path) && path !== "acceptance/ScreenReport.spec.js").sort()
        const specText = specNames.map(textOf).join("")
        const smoke = textOf("test/client/BrowserSmoke.spec.js")
        const rows = files.filter((file) => file.endsWith(".xml"))
            .sort((a, b) => a.slice(7, -4).toLowerCase() < b.slice(7, -4).toLowerCase() ? -1 : a.slice(7, -4).toLowerCase() > b.slice(7, -4).toLowerCase() ? 1 : 0)
            .map((file) => {
                const path = file.slice(7, -4)
                const under = path.startsWith("SimpleScreens/") ? path.slice("SimpleScreens/".length) : path
                const name = path.split("/").pop()
                const found = discovery.has(under) ? "yes" : SKIP.includes(name) ? "excluded" : ""
                const targeted = new RegExp(`(?<![A-Za-z0-9/])${escape(under)}(?![A-Za-z0-9])`).test(specText) ? "yes" : ""
                const smoked = new RegExp(`apps/SimpleScreens/${escape(under)}(?![A-Za-z0-9])`).test(smoke) ? "yes" : ""
                const base = file.slice(0, -4) + "."
                const companions = Array.from(new Set(files.filter((other) => other.startsWith(base) && !other.endsWith(".xml"))
                    .map((other) => other.split(".").slice(1).join(".")))).sort().join(", ")
                return [path, found, targeted, smoked, companions]
            })
        const count = (test) => rows.filter(test).length
        const summary = `${rows.length} screens; discovery ${count((r) => r[1] === "yes")}, targeted ${count((r) => r[2])}, ` +
            `either ${count((r) => r[1] === "yes" || r[2])}, smoke ${count((r) => r[3])}.`
        const lines = ["# mr-marble screen report", "", summary, "",
            "| Screen | Discovery | Targeted | Smoke | Companion files |", "| --- | :-: | :-: | :-: | --- |",
            ...rows.map(([path, found, targeted, smoked, companions]) => `| \`${path}\` | ${found} | ${targeted} | ${smoked} | ${companions} |`)]
        const location = /^[a-z][a-z0-9+.-]*:/i.test(OUT) ? OUT : `file:${OUT}`
        ec.resource.getLocationReference(location).putText(lines.join("\n") + "\n")
        log.warn(`wrote ${OUT}: ${summary}`)
        return { rows, discovery, written: String(ec.resource.getLocationText(location) || "") }
    },
    then({ rows, discovery, written }) {
        discovery.size > 0
        rows.length > 0
        written.startsWith("# mr-marble screen report")
    },
})
