// Party › Emails' EmailMessage (screen/SimpleScreens/Party/PartyEmails.xml): a message's body only for a message of the
// party's, as its list finds them, never by the id alone, and sandboxed, since it is mail from outside and not cleaned
// (plans/Security-Review.md SEC-MAIL-63).
// Send again (sendEmailMessage of Party › Emails and Order › Detail; Shipment and Invoice have the same check): only a message
// of the party or the order shown, never any message by its id (plans/Security-Review-Medium.md SEC-MAIL-64).
// Run: ./moq test mr-marble --spec PartyEmailBody
const webroot = "component://webroot/screen/webroot.xml"
const PARTY = "CustJqp"
const OWN = "SPEC_PEB_OWN"
const OTHER = "SPEC_PEB_OTHER"
const ORDER = "SPEC_PEB_ORDER"
const SERVER = "SPEC_PEB_SMTP"
const capture = ec.factory.getTool("MailCapture")

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
            body, emailServerId: SERVER }, true, null, null)
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
        capture.enable()
        sys(() => {
            if (ec.entity.find("moqui.basic.email.EmailServer").condition("emailServerId", SERVER).count() === 0)
                ec.service.sync().name("create#moqui.basic.email.EmailServer").parameters({ emailServerId: SERVER, smtpHost: "127.0.0.1",
                    smtpPort: "25" }).call()
        })
        message(OWN, address, "<p>Your order shipped</p>")
        message(OTHER, "admin@example.invalid", "<p>Your reset password is 1234</p>")
        sys(() => {
            if (ec.entity.find("mantle.order.OrderHeader").condition("orderId", ORDER).count() === 0) {
                ec.service.sync().name("create#mantle.order.OrderHeader").parameters({ orderId: ORDER, statusId: "OrderOpen",
                    currencyUomId: "USD", entryDate: ec.user.nowTimestamp }).call()
                ec.service.sync().name("create#mantle.order.OrderEmailMessage").parameters({ orderId: ORDER, emailMessageId: OWN }).call()
            }
        })
    },
    cleanupSpec() {
        capture.reset()
    },
})
const send = (path, parameters) => {
    const before = capture.count()
    const rendered = ec.screen.makeTest().rootScreen(webroot).render(path, parameters, "post")
    ec.message.clearErrors()
    return { sent: capture.count() - before, errors: rendered.errorMessages.join(" ") }
}

feature("send again: a message of the party or the order shown is sent; another message is not found and not sent", {
    when() {
        return {
            partyOther: send("apps/marble/Party/PartyEmails/sendEmailMessage", { partyId: PARTY, emailMessageId: OTHER }),
            partyOwn: send("apps/marble/Party/PartyEmails/sendEmailMessage", { partyId: PARTY, emailMessageId: OWN }),
            orderOther: send("apps/marble/Order/OrderDetail/sendEmailMessage", { orderId: ORDER, emailMessageId: OTHER }),
            orderOwn: send("apps/marble/Order/OrderDetail/sendEmailMessage", { orderId: ORDER, emailMessageId: OWN }),
        }
    },
    then({ partyOther, partyOwn, orderOther, orderOwn }) {
        partyOther.sent == 0
        partyOther.errors.includes("not found for this party")
        partyOwn.sent == 1
        orderOther.sent == 0
        orderOther.errors.includes("not found for this order")
        orderOwn.sent == 1
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
