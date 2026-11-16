// A wiki page of type md in the terminal (screen/SimpleScreens/Wiki/wiki.xml, its render-mode tui text): the page's text is sent
// as a markdown node with an id, where it was first source text and then a markdown node with no id, which the terminal client
// refused ("screen model json: missing field `id`"). One tui render of a page of a space made here.
// Run: ./moq test mr-marble --spec WikiPageTui
const webroot = "component://webroot/screen/webroot.xml"
const SPACE = "SPECWTUI"

spec({
    setupSpec() {
        login("john.doe")
        const wasDisabled = ec.artifactExecution.disableAuthz()
        try {
            if (!ec.entity.find("moqui.resource.wiki.WikiSpace").condition("wikiSpaceId", SPACE).one()) {
                call("org.moqui.resource.WikiServices.create#WikiSpace", {wikiSpaceId: SPACE, description: "Spec wiki in the terminal"})
                call("org.moqui.resource.WikiServices.update#WikiPage", {
                    wikiSpaceId: SPACE,
                    pageName: "Page1",
                    pageText: "# Spec heading\n\nSpec *markdown* text\n"
                })
            }
        } finally {
            if (!wasDisabled) ec.artifactExecution.enableAuthz()
        }
    }
})

feature("a markdown page reaches the terminal as a markdown node with its id and the page's text", {
    when() {
        const str = ec.screen.makeTest().rootScreen(webroot).renderMode("tui").render(`apps/marble/Wiki/wiki/${SPACE}/Page1`, {}, null)
        ec.message.clearErrors()
        const nodes = []
        const walk = node => {
            if (!node || typeof node !== "object") return
            if (node.t === "markdown") nodes.push(node)
            for (const child of Array.from(node.c || [])) walk(child)
        }
        walk(str.jsonObject)
        return {status: str.status, errors: str.errorMessages.join(" | "), nodes}
    },
    then({status, errors, nodes}) {
        status == 200
        errors == ""
        nodes.length == 1
        nodes[0].id == "WikiPageText"
        nodes[0].text == "# Spec heading\n\nSpec *markdown* text\n"
    }
})
