// Marble's request and task screens (screen/SimpleScreens/Request.xml, Task.xml) open a record only when Mantle's rule for
// it inside the user's organizations admits it (SearchScope.js hitHidden, the universal search's per-hit rule; plans/
// Security-Review.md SEC-DAT-98): a reported maintenance problem is not opened, nor changed through its transitions, by a
// user who is not its reporter, on it or in Maintenance; an administrator opens it. One html render of Edit Request.
// Run: ./moq test mr-marble --spec RecordScreenScope
const REQUEST = "SPEC_RSS_MAINT"
const PLAIN = "SPEC_RSS_PLAIN"
const HR_CASE = "SPEC_RSS_HRCASE"
const WORK_ORDER = "SPEC_RSS_WO"
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
        // a confidential HR case of the organization (the finding's own scenario), and a maintenance work order
        make("mantle.request.Request", {requestId: HR_CASE, requestTypeEnumId: "RqtHrCase", statusId: "ReqSubmitted",
            requestName: "SPECRSS harassment complaint"})
        make("mantle.request.RequestParty", {requestId: HR_CASE, partyId: "ORG_ZIZI_RETAIL", roleTypeId: "OrgInternal",
            fromDate: ec.user.nowTimestamp})
        make("mantle.work.effort.WorkEffort", {workEffortId: WORK_ORDER, workEffortTypeEnumId: "WetTask", statusId: "WeApproved",
            workEffortName: "SPECRSS boiler repair"})
        make("mantle.work.maintenance.MaintenanceWorkOrder", {workEffortId: WORK_ORDER})
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

// the finding's own scenario: a confidential HR case is in no request find, is not opened or changed, and no one puts
// themselves on it from the Party screens to read it in My Account; a maintenance work order the same for the Task screens
feature("an HR case is in no request list, is not opened or changed, and no one puts themselves on it; a hidden work order the same (SEC-DAT-98)", {
    when() {
        const asPlain = (path, parameters, method = "post") => {
            login("spec.rss.plain")
            try {
                const out = sys(() => ec.screen.makeTest().rootScreen(root).renderMode(method ? null : "html")
                    .render(path, parameters, method))
                const errors = Array.from(out.errorMessages || []).join(" | ") + (ec.message.hasError() ? ec.message.getErrorsString() : "")
                ec.message.clearErrors()
                return {output: String(out.output || ""), errors}
            } finally {
                login("john.doe")
            }
        }
        const list = asPlain("Request/FindRequest", {requestName: "SPECRSS", requestName_op: "contains"}, null)
        const opened = asPlain("Request/EditRequest/updateRequest", {requestId: HR_CASE, requestName: "SPECRSS changed"})
        const selfAdded = asPlain("Party/PartyRequests/addUser", {partyId: PLAIN, requestId: HR_CASE, roleTypeId: "Watcher",
            fromDate: ec.user.nowTimestamp})
        const selfAssigned = asPlain("Party/PartyTasks/addUserAssign", {partyId: PLAIN, workEffortId: WORK_ORDER, roleTypeId: "Assignee",
            fromDate: ec.user.nowTimestamp, statusId: "WeptAssigned"})
        const taskChanged = asPlain("Task/EditTask/updateTask", {workEffortId: WORK_ORDER, workEffortName: "SPECRSS changed"})
        const one = (entity, conditions) => sys(() => ec.entity.find(entity).condition(conditions).useCache(false).one())
        const count = (entity, conditions) => sys(() => ec.entity.find(entity).condition(conditions).count())
        return {list, opened, selfAdded, selfAssigned, taskChanged,
            caseName: one("mantle.request.Request", {requestId: HR_CASE}).requestName,
            onCase: count("mantle.request.RequestParty", {requestId: HR_CASE, partyId: PLAIN}),
            onOrder: count("mantle.work.effort.WorkEffortParty", {workEffortId: WORK_ORDER, partyId: PLAIN}),
            orderName: one("mantle.work.effort.WorkEffort", {workEffortId: WORK_ORDER}).workEffortName}
    },
    then({list, opened, selfAdded, selfAssigned, taskChanged, caseName, onCase, onOrder, orderName}) {
        !list.output.includes("SPECRSS harassment complaint")
        !list.output.includes("SPECRSS pump leak")
        opened.errors.includes("is not available")
        caseName == "SPECRSS harassment complaint"
        onCase == 0
        onOrder == 0
        taskChanged.errors.includes("is not available")
        orderName == "SPECRSS boiler repair"
    }
})
