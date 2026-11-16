// My Account › Scheduled Finds' EditScheduledFind (screen/MyAccount/User/ScheduledFinds/EditScheduledFind.xml): the update
// sets only the fields the form edits, so a request cannot set another field of the user's own scheduled find (its
// user, screen or save location).
// Run: ./moq test mr-marble --spec ScheduledFindEdit
const webroot = "component://webroot/screen/webroot.xml"
const SCHEDULED = "SPEC_SSF_EDIT"

function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
const remove = () => sys(() => ec.entity.find("moqui.screen.ScreenScheduled").condition("screenScheduledId", SCHEDULED).deleteAll())
const row = () => sys(() => ec.entity.find("moqui.screen.ScreenScheduled").condition("screenScheduledId", SCHEDULED).one())

spec({
    setupSpec() {
        login("john.doe")
        remove()
        sys(() => ec.service.sync().name("create#moqui.screen.ScreenScheduled").parameters({ screenScheduledId: SCHEDULED,
            screenPath: "marble/Order/FindOrder", renderMode: "csv", cronExpression: "0 0 6 ? * *", userId: ec.user.userId,
            emailSubject: "Spec orders" }).call())
    },
    cleanupSpec() {
        remove()
    },
})

feature("an edit of a scheduled find sets the form's fields only", {
    when() {
        const rendered = ec.screen.makeTest().rootScreen(webroot).render("apps/my/User/ScheduledFinds/EditScheduledFind/updateScreenScheduled",
            { screenScheduledId: SCHEDULED, renderMode: "xlsx", emailSubject: "Spec orders weekly", cronExpression: "0 0 6 ? * MON",
                userId: "EX_JOHN_DOE_OTHER", screenPath: "tools/Entity/DataEdit", saveToLocation: "file:///tmp/spec-ssf.csv" }, "post")
        ec.message.clearErrors()
        return { errors: rendered.errorMessages, saved: row(), userId: ec.user.userId }
    },
    then({ errors, saved, userId }) {
        errors.length == 0
        saved.renderMode == "xlsx"
        saved.emailSubject == "Spec orders weekly"
        saved.cronExpression == "0 0 6 ? * MON"
        saved.userId == userId
        saved.screenPath == "marble/Order/FindOrder"
        saved.saveToLocation == null
    },
})
