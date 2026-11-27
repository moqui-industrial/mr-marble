// A wiki page on the Marble wiki screens (screen/SimpleScreens/Wiki/wiki.xml, ViewWikiPage.xml): the page is rendered by
// WikiServices.render#WikiPage, found by its space and path, never by a location rendered as a template
// (plans/archive/Security-Review.md SEC-SCR-81). The qvt render shows the page's HTML under v-pre, its markup cleaned and its
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
// a comment is text in the qvt template, not a Vue expression or HTML
const COMMENT = "Spec comment {{ 6 * 7 }} with <b>tags</b>"

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
            // a public address whose ${} names are filled as text: a page value, a name with none, an expression
            call("update#moqui.resource.wiki.WikiSpace", {wikiSpaceId: SPACE,
                publicPageUrl: "https://help.example.com/${pagePath}?c=${constructor}&u=${ec.user.username}"})
            call("org.moqui.resource.WikiServices.update#WikiPage", {wikiSpaceId: SPACE, pageName: "Page1", pageText: PAGE_TEXT})
            const page = ec.entity.find("moqui.resource.wiki.WikiPage").condition({wikiSpaceId: SPACE, pagePath: "Page1"}).one()
            // written as rows: the comment service refuses markup, which a comment that came another way (an import) has
            if (!ec.entity.find("mantle.party.communication.WikiPageCommunicationEvent").condition("wikiPageId", page.wikiPageId).count()) {
                ec.entity.makeValue("mantle.party.communication.CommunicationEvent").setAll({communicationEventId: "SPEC_WIKI_COMMENT",
                    communicationEventTypeId: "Comment", statusId: "CeSent", fromPartyId: "EX_JOHN_DOE", entryDate: ec.user.nowTimestamp,
                    contentType: "text/plain", subject: "Spec comment", body: COMMENT}).create()
                ec.entity.makeValue("mantle.party.communication.WikiPageCommunicationEvent")
                    .setAll({wikiPageId: page.wikiPageId, communicationEventId: "SPEC_WIKI_COMMENT"}).create()
            }
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
        // the comment's text encoded: no tag of it, and no {{ }} of it the browser's Vue would evaluate
        output.includes("Spec comment")
        output.includes("&lt;b&gt;tags&lt;/b&gt;")
        !output.includes("<b>tags</b>")
        !output.includes(COMMENT.replace("<b>tags</b>", "&lt;b&gt;tags&lt;/b&gt;"))
        // the public link: Mantle's fill (PublicUrlPattern.js), no value for a name the page has not
        output.includes("https://help.example.com/Page1?c=&amp;u=${ec.user.username}") || output.includes("https://help.example.com/Page1?c=&u=${ec.user.username}")
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
