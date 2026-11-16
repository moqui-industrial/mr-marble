// My Account › Messages' SingleMessage (screen/MyAccount/User/Messages/MessageThread/SingleMessage.xml): a message with no To
// party names its sender and date and no recipient, where it read "to null" (TUI review 2026-11-16).
// Run: ./moq test mr-marble --spec MessageRecipient
const webroot = "component://webroot/screen/webroot.xml"
const MESSAGE = "SPEC_MSG_NO_TO"

function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
const remove = () =>
    sys(() => ec.entity.find("mantle.party.communication.CommunicationEvent").condition("communicationEventId", MESSAGE).deleteAll())

spec({
    setupSpec() {
        login("john.doe")
        remove()
        sys(() =>
            ec.service
                .sync()
                .name("create#mantle.party.communication.CommunicationEvent")
                .parameters({
                    communicationEventId: MESSAGE,
                    communicationEventTypeId: "Message",
                    fromPartyId: "EX_JOHN_DOE",
                    subject: "Spec message with no recipient",
                    body: "Spec body with no recipient",
                    entryDate: ec.user.nowTimestamp
                })
                .call()
        )
    },
    cleanupSpec() {
        remove()
    }
})

feature("a message with no To party shows its sender and no recipient", {
    when() {
        const str = ec.screen
            .makeTest()
            .rootScreen(webroot)
            .renderMode("qvt")
            .withStaticData()
            .render("apps/my/User/Messages/MessageThread/SingleMessage", {communicationEventId: MESSAGE, lastStandalone: "true"}, null)
        const output = String(str.output || "")
        ec.message.clearErrors()
        return {status: str.status, errors: str.errorMessages.join(" | "), output}
    },
    then({status, errors, output}) {
        status == 200
        errors == ""
        output.includes("Spec body with no recipient")
        output.includes("From EX_JOHN_DOE: John Doe,")
        !output.includes("to null")
        !/>to [^<]*</.test(output)
    }
})
