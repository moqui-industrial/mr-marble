// My Account's account form (screen/MyAccount/User/Account.xml, updateUser): the transition passes update#Account the
// user's own account and only the form's fields (plans/Security-Review.md SEC-RTE-81). A post that names another account,
// as a plain userId or as a multi post's userId_0, and a posted username change nothing but the caller's own fields.
// Run: ./moq test mr-marble --spec MyAccountUpdate
const webroot = "component://webroot/screen/webroot.xml"
const OTHER = "SPEC_ACCT_OTHER"
const OTHER_EMAIL = "spec.acct.other@example.com"
let before

function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
const account = userId => sys(() => ec.entity.find("moqui.security.UserAccount").condition("userId", userId).useCache(false).one())
const person = partyId => sys(() => ec.entity.find("mantle.party.Person").condition("partyId", partyId).useCache(false).one())

spec({
    setupSpec() {
        login("john.doe")
        sys(() => {
            if (!account(OTHER))
                ec.entity.makeValue("moqui.security.UserAccount")
                    .setAll({userId: OTHER, username: "spec.acct.other", userFullName: "Spec Other", emailAddress: OTHER_EMAIL})
                    .create()
        })
        const own = account(ec.user.userId)
        before = {username: own.username, emailAddress: own.emailAddress, partyId: own.partyId, middleName: person(own.partyId)?.middleName ?? null}
    },
    cleanupSpec() {
        sys(() => {
            const own = account(ec.user.userId)
            if (own.username !== before.username) {
                own.username = before.username
                own.update()
            }
            const party = person(before.partyId)
            if (party && (party.middleName ?? null) !== before.middleName) {
                party.middleName = before.middleName
                party.update()
            }
            account(OTHER)?.delete()
        })
    }
})

feature("updateUser changes the caller's own account only, whatever userId, userId_0 or username the post names", {
    when() {
        const out = sys(() =>
            ec.screen.makeTest().rootScreen(webroot).render("apps/my/User/Account/updateUser", {
                userId: OTHER,
                username: "spec.acct.hijack",
                firstName: person(before.partyId)?.firstName ?? "John",
                middleName: "Specmiddle",
                lastName: person(before.partyId)?.lastName ?? "Doe",
                emailAddress: before.emailAddress,
                _isMulti: "true",
                userId_0: OTHER,
                emailAddress_0: "spec.acct.stolen@example.com"
            }, "post")
        )
        const errors = Array.from(out.errorMessages || []).join(" | ")
        ec.message.clearErrors()
        return {status: out.status, errors, own: account(ec.user.userId), other: account(OTHER), party: person(before.partyId)}
    },
    then({status, errors, own, other, party}) {
        status < 400
        errors == ""
        party.middleName == "Specmiddle"
        own.username == before.username
        own.emailAddress == before.emailAddress
        other.emailAddress == OTHER_EMAIL
        other.username == "spec.acct.other"
    }
})
