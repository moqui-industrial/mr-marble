// Marble's request and task screens (screen/SimpleScreens/Request.xml, Task.xml) open a record only when Mantle's rule for
// it inside the user's organizations admits it (SearchScope.js hitHidden, the universal search's per-hit rule; plans/
// Security-Review.md SEC-DAT-98): a reported maintenance problem is not opened, nor changed through its transitions, by a
// user who is not its reporter, on it or in Maintenance; an administrator opens it. One html render of Edit Request.
// Run: ./moq test mr-marble --spec RecordScreenScope
const REQUEST = "SPEC_RSS_MAINT"
const PLAIN = "SPEC_RSS_PLAIN"
const root = "component://mr-marble/screen/SimpleScreens.xml"

function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
const make = (entity, values) => sys(() => ec.service.sync().name("create#" + entity).parameters(values).call())
const request = () => sys(() => ec.entity.find("mantle.request.Request").condition("requestId", REQUEST).useCache(false).one())

spec({
    setupSpec() {
        login("john.doe")
        make("mantle.party.Party", {partyId: PLAIN, partyTypeEnumId: "PtyPerson"})
        make("mantle.party.Person", {partyId: PLAIN, firstName: "Spec", lastName: "Plain"})
        make("moqui.security.UserAccount", {userId: PLAIN, username: "spec.rss.plain", partyId: PLAIN,
            currentPassword: "16ac58bbfa332c1c55bd98b53e60720bfa90d394", passwordHashType: "SHA"})
        make("mantle.request.Request", {requestId: REQUEST, requestTypeEnumId: "RqtMaintenance", statusId: "ReqSubmitted",
            requestName: "SPECRSS pump leak"})
        make("mantle.request.RequestParty", {requestId: REQUEST, partyId: "ORG_ZIZI_RETAIL", roleTypeId: "OrgInternal",
            fromDate: ec.user.nowTimestamp})
    },
    cleanup() {
        login("john.doe")
    }
})

feature("a maintenance request outside the user's Maintenance reach is neither opened nor changed in Marble's request screens (SEC-DAT-98)", {
    when() {
        login("spec.rss.plain")
        const rendered = sys(() => ec.screen.makeTest().rootScreen(root).renderMode("html").render("Request/EditRequest", {requestId: REQUEST}, null))
        const output = String(rendered.output || "")
        ec.message.clearErrors()
        const posted = sys(() => ec.screen.makeTest().rootScreen(root).render("Request/EditRequest/updateRequest",
            {requestId: REQUEST, requestName: "SPECRSS changed"}, "post"))
        const postErrors = Array.from(posted.errorMessages || []).join(" | ") + (ec.message.hasError() ? ec.message.getErrorsString() : "")
        ec.message.clearErrors()
        login("john.doe")
        const admin = sys(() => ec.resource.script("component://mr-mantle/service/mantle/search/SearchScope.js")
            .hitHidden("MantleRequest", request(), ec.user.userAccount?.partyId || null))
        return {output, postErrors, admin, name: request().requestName}
    },
    then({output, postErrors, admin, name}) {
        !output.includes("SPECRSS pump leak")
        output.includes("is not available") || postErrors.includes("is not available")
        postErrors.includes("is not available")
        name == "SPECRSS pump leak"
        admin == false
    }
})
