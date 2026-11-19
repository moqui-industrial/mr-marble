// A wiki page on the Marble wiki screens (screen/SimpleScreens/Wiki/wiki.xml, ViewWikiPage.xml): the page is rendered by
// WikiServices.render#WikiPage, found by its space and path, never by a location rendered as a template
// (plans/Security-Review.md SEC-SCR-81). The qvt render shows the page's HTML under v-pre, its markup cleaned and its
// ${} and {{ }} as text; a request's pageLocation is ignored, also where the page is not found; the terminal gets a
// markdown page as one markdown node with its id (it was first source text, then a node with no id, which the terminal
// client refused: "screen model json: missing field `id`"). One render of each screen in each mode it has a template for.
// Run: ./moq test mr-marble --spec WikiPage
const webroot = "component://webroot/screen/webroot.xml"
const SPACE = "SPECWTUI"
const PAGE_TEXT = "# Spec heading\n\nSpec *markdown* text with {{ 6 * 7 }} and ${ec.user.username}.\n\n[Next page](Page2)\n\n" +
    "<script>alert('spec script')</script>\n"
// a component file a request names as the page's location; rendered as a template it would show this text of it
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
function render(mode, path, parameters) {
    let test = ec.screen.makeTest().rootScreen(webroot).renderMode(mode)
    if (mode === "qvt") test = test.withStaticData()
    const str = test.render(path, parameters, null)
    const errors = Array.from(str.errorMessages || []).join(" | ")
    ec.message.clearErrors()
    return {status: str.status, errors, output: String(str.output || ""), json: str.jsonObject}
}

spec({
    setupSpec() {
        login("john.doe")
        sys(() => {
            if (!ec.entity.find("moqui.resource.wiki.WikiSpace").condition("wikiSpaceId", SPACE).one())
                call("org.moqui.resource.WikiServices.create#WikiSpace", {wikiSpaceId: SPACE, description: "Spec wiki"})
            call("org.moqui.resource.WikiServices.update#WikiPage", {wikiSpaceId: SPACE, pageName: "Page1", pageText: PAGE_TEXT})
        })
    }
})

feature("the wiki screen shows a page through render#WikiPage, its HTML cleaned and not a template, and ignores a request's pageLocation", {
    when() {
        return render("qvt", `apps/marble/Wiki/wiki/${SPACE}/Page1`, {lastStandalone: "true", pageLocation: COMPONENT_FILE})
    },
    then({status, errors, output}) {
        status == 200
        errors == ""
        !output.includes("Error rendering")
        /<div v-pre>\s*<h1[^>]*>Spec heading<\/h1>/.test(output)
        // the page's text is text: a {{ }} under v-pre, a ${} not expanded, a script element cleaned out
        /<div v-pre>[\s\S]*\{\{ 6 \* 7 \}\}/.test(output)
        output.includes("${ec.user.username}")
        !output.includes("alert('spec script')")
        // a relative link resolves against the wiki screen's path of this server, not a URL with a host
        /href="\/[^"]*\/wiki\/SPECWTUI\/Page2"/.test(output)
        !output.includes(COMPONENT_TEXT)
    }
})

feature("the view screen renders nothing of a request's pageLocation where the page is not found", {
    when() {
        return render("html", "apps/marble/Wiki/ViewWikiPage/NOSPACE/Page1", {pageLocation: COMPONENT_FILE})
    },
    then({errors, output}) {
        errors.includes("Space not found")
        !output.includes(COMPONENT_TEXT)
        !output.includes("Error rendering")
    }
})

feature("a markdown page reaches the terminal as a markdown node with its id and the page's text", {
    when() {
        const {status, errors, json} = render("tui", `apps/marble/Wiki/wiki/${SPACE}/Page1`, {})
        const nodes = []
        const walk = node => {
            if (!node || typeof node !== "object") return
            if (node.t === "markdown") nodes.push(node)
            for (const child of Array.from(node.c || [])) walk(child)
        }
        walk(json)
        return {status, errors, nodes}
    },
    then({status, errors, nodes}) {
        status == 200
        errors == ""
        nodes.length == 1
        nodes[0].id == "WikiPageText"
        // the page's own text, its script element cleaned out
        nodes[0].text == PAGE_TEXT.replace("<script>alert('spec script')</script>", "")
        !nodes[0].text.includes("<script")
    }
})
