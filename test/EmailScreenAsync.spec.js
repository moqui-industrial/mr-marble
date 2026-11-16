// The report screens' Email Export (webroot BasicTransitions.xml emailScreenAsync, included by the Accounting reports):
// the transition passes the service the form's own fields, so a request does not choose the template, Cc or Bcc, and a
// fileName from the request is the attachment's name as written, never expanded as script (plans/Security-Review.md
// SEC-MAIL-61). The mail goes through the mail capture, from a server of the spec's own.
// Run: ./moq test mr-marble --spec EmailScreenAsync
const webroot = "component://webroot/screen/webroot.xml"
const SERVER = "SPEC_ESA_MAIL"
const capture = ec.factory.getTool("MailCapture")
let saved = null

function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
const template = () => ec.entity.find("moqui.basic.email.EmailTemplate").condition("emailTemplateId", "SCREEN_RENDER").one()

spec({
    setupSpec() {
        login("john.doe")
        capture.enable()
        sys(() => {
            if (ec.entity.find("moqui.basic.email.EmailServer").condition("emailServerId", SERVER).count() === 0) {
                const server = ec.entity.makeValue("moqui.basic.email.EmailServer")
                server.setFields({ emailServerId: SERVER, smtpHost: "127.0.0.1", smtpPort: "25" }, true, null, null)
                server.create()
            }
            const row = template()
            saved = { emailServerId: row.emailServerId, fromAddress: row.fromAddress }
            row.setFields({ emailServerId: SERVER, fromAddress: "reports@example.invalid" }, true, null, null)
            row.update()
        })
    },
    cleanupSpec() {
        capture.reset()
        if (saved) sys(() => {
            const row = template()
            row.setFields(saved, true, null, null)
            row.update()
        })
    },
})

feature("the request's template, Cc and Bcc are not taken, and its fileName is the attachment's name as written", {
    when() {
        capture.clear()
        const res = ec.screen.makeTest().rootScreen(webroot).render("apps/marble/Accounting/Reports/AssetOnHand/emailScreenAsync", {
            toAddresses: "report.reader@example.invalid", screenRenderMode: "csv", title: "Spec asset report",
            fileName: "${1+1}.csv", emailTemplateId: "PASSWORD_RESET", ccAddresses: "cc.spy@example.invalid",
            bccAddresses: "bcc.spy@example.invalid", createEmailMessage: "true",
        }, "post")
        const errors = res.errorMessages.join(" | ")
        ec.message.clearErrors()
        // the send is async: wait for it, up to 20 seconds
        for (const started = Date.now(); capture.count() === 0 && Date.now() - started < 20000;);
        const mail = capture.last()
        return { errors, mail }
    },
    then({ errors, mail }) {
        errors == ""
        mail != null
        String(mail.subject) == "Spec asset report"
        Array.from(mail.toList).join(",") == "report.reader@example.invalid"
        Array.from(mail.ccList).length == 0
        Array.from(mail.bccList).length == 0
        Array.from(mail.attachmentNames).includes("${1+1}.csv")
    },
})
