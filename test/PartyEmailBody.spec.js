// Party › Emails' EmailMessage (screen/SimpleScreens/Party/PartyEmails.xml): a message's body only for a message of the
// party's, as its list finds them, never by the id alone, and sandboxed, since it is mail from outside and not cleaned
// (plans/Security-Review.md SEC-MAIL-63).
// Run: ./moq test mr-marble --spec PartyEmailBody
const webroot = "component://webroot/screen/webroot.xml"
const PARTY = "CustJqp"
const OWN = "SPEC_PEB_OWN"
const OTHER = "SPEC_PEB_OTHER"

function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
function message(emailMessageId, toAddresses, body) {
    sys(() => {
        if (ec.entity.find("moqui.basic.email.EmailMessage").condition("emailMessageId", emailMessageId).count() > 0) return
        const row = ec.entity.makeValue("moqui.basic.email.EmailMessage")
        row.setFields({ emailMessageId, statusId: "ES_SENT", subject: "Spec " + emailMessageId, toAddresses, fromAddress: "store@example.invalid",
            body }, true, null, null)
        row.create()
    })
}
const show = (emailMessageId) => ec.screen.makeTest().rootScreen(webroot)
    .render("apps/marble/Party/PartyEmails/EmailMessage", { partyId: PARTY, emailMessageId }, "get")

spec({
    setupSpec() {
        login("john.doe")
        const address = sys(() => ec.entity.find("mantle.party.contact.PartyContactMechInfo").condition("partyId", PARTY)
            .condition("contactMechTypeEnumId", "CmtEmailAddress").list()[0]?.infoString)
        if (!address) skip(`${PARTY} has no email address in this database`)
        message(OWN, address, "<p>Your order shipped</p>")
        message(OTHER, "admin@example.invalid", "<p>Your reset password is 1234</p>")
    },
})

feature("the party's own message comes back sandboxed; another's is not found by its id", {
    when() {
        const own = show(OWN)
        const other = show(OTHER)
        ec.message.clearErrors()
        return { own, other }
    },
    then({ own, other }) {
        own.output.includes("Your order shipped")
        String(own.header("Content-Security-Policy") ?? "").startsWith("sandbox")
        own.header("X-Content-Type-Options") == "nosniff"
        !other.output.includes("reset password")
        other.errorMessages.join(" ").includes("not found")
    },
})
