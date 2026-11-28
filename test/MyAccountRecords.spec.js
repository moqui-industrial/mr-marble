// My Account (screen/MyAccount/) acts only on the user's own records (plans/archive/Security-Review.md SEC-RTE-81): a post that
// names another party's contact information, message, time entry, request content or expense invoice changes nothing
// of it, and another party's message does not render. MyAccount.xml set the user's partyId only in pre-actions, which a
// transition does not run, and several screens checked ownership nowhere or only in their render actions. As a user in
// MY_ACCOUNT_USERS only, not ADMIN, with authorization on. Run: ./moq test mr-marble --spec MyAccountRecords
const webroot = "component://webroot/screen/webroot.xml"
const ME = "SPEC_MAR_ME"
const OTHER = "SPEC_MAR_OTHER"
const ids = {
    email: "SPEC_MAR_EMAIL",
    message: "SPEC_MAR_MSG",
    time: "SPEC_MAR_TIME",
    myRequest: "SPEC_MAR_REQ_ME",
    otherRequest: "SPEC_MAR_REQ_OTHER",
    content: "SPEC_MAR_CONTENT",
    invoice: "SPEC_MAR_INV"
}
const SECRET = "spec other party's content"

function sys(run) {
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return run()
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
const one = (entity, fields) => sys(() => ec.entity.find(entity).condition(fields).useCache(false).one())
const make = (entity, values) => sys(() => ec.entity.makeValue(entity).setAll(values).create())
// a request as the signed-in user, authorization on: status, error text and output
function request(path, parameters, method) {
    const out = ec.screen.makeTest().rootScreen(webroot).render(path, parameters, method)
    const errors = Array.from(out.errorMessages || []).join(" | ")
    ec.message.clearErrors()
    return {status: out.status, errors, output: String(out.output || "")}
}
function person(partyId) {
    make("mantle.party.Party", {partyId, partyTypeEnumId: "PtyPerson"})
    make("mantle.party.Person", {partyId, firstName: "Spec", lastName: partyId})
    make("moqui.security.UserAccount", {userId: partyId, username: partyId.toLowerCase(), partyId, userFullName: "Spec " + partyId,
        currentPassword: "16ac58bbfa332c1c55bd98b53e60720bfa90d394", passwordHashType: "SHA", emailAddress: partyId.toLowerCase() + "@example.com"})
}

spec({
    setupSpec() {
        login("john.doe")
        if (one("mantle.party.Party", {partyId: ME})) return
        person(ME)
        person(OTHER)
        make("moqui.security.UserGroupMember", {userGroupId: "MY_ACCOUNT_USERS", userId: ME, fromDate: 0})
        // the other party's contact information, message, time entry, request with content, and expense invoice
        make("mantle.party.contact.ContactMech", {contactMechId: ids.email, contactMechTypeEnumId: "CmtEmailAddress", infoString: "spec.other@example.com"})
        make("mantle.party.contact.PartyContactMech", {partyId: OTHER, contactMechId: ids.email, contactMechPurposeId: "EmailPrimary", fromDate: 0})
        make("mantle.party.communication.CommunicationEvent", {communicationEventId: ids.message, communicationEventTypeId: "Message",
            fromPartyId: OTHER, toPartyId: OTHER, subject: "Spec private subject", body: "Spec private body", statusId: "CeReceived", entryDate: 0})
        make("mantle.work.time.TimeEntry", {timeEntryId: ids.time, partyId: OTHER, fromDate: 0, hours: 2, comments: "theirs"})
        for (const [requestId, partyId] of [[ids.myRequest, ME], [ids.otherRequest, OTHER]]) {
            make("mantle.request.Request", {requestId, requestTypeEnumId: "RqtSupport", statusId: "ReqSubmitted", requestName: "Spec " + requestId})
            make("mantle.request.RequestParty", {requestId, partyId, roleTypeId: "Customer", fromDate: 0})
        }
        sys(() => ec.resource.getLocationReference("dbresource://SpecMyAccount/content.txt").putText(SECRET))
        make("mantle.request.RequestContent", {requestContentId: ids.content, requestId: ids.otherRequest,
            contentLocation: "dbresource://SpecMyAccount/content.txt", description: "theirs"})
        make("mantle.account.invoice.Invoice", {invoiceId: ids.invoice, invoiceTypeEnumId: "InvoiceSales", fromPartyId: OTHER, toPartyId: OTHER,
            statusId: "InvoiceIncoming", currencyUomId: "USD", description: "theirs"})
    },
    cleanup() {
        login("john.doe")
    }
})

feature("a post naming another party's records changes none of them", {
    when() {
        login(ME.toLowerCase())
        const removed = request("apps/my/User/ContactInfo/removeContactInfo", {partyId: OTHER, contactMechId: ids.email}, "post")
        const stored = request("apps/my/User/ContactInfo/UpdateContactInfo/storeContactInfo", {partyId: OTHER,
            emailContactMechId: ids.email, emailContactMechPurposeId: "EmailPrimary", emailAddress: "spec.stolen@example.com"}, "post")
        const message = request("apps/my/User/Messages/EditMessage/updateMessage", {communicationEventId: ids.message, body: "Spec stolen body"}, "post")
        const timeAsOther = request("apps/my/User/TimeEntries/EditTimeEntry/recordTimeEntry", {partyId: OTHER, timeEntryId: ids.time,
            hours: "9", comments: "stolen"}, "post")
        const newTime = request("apps/my/User/TimeEntries/recordTimeEntry", {partyId: OTHER, fromDate: String(Date.now()), hours: "1",
            comments: "spec my hour"}, "post")
        const content = request("apps/my/User/Request/EditRequest/updateContent", {requestId: ids.myRequest, requestContentId: ids.content,
            description: "moved"}, "post")
        const invoice = request("apps/my/Expense/EditExpenseInvoice/updateInvoice", {invoiceId: ids.invoice, description: "stolen"}, "post")
        return {
            removed, stored, message, timeAsOther, newTime, content, invoice,
            pcm: one("mantle.party.contact.PartyContactMech", {partyId: OTHER, contactMechId: ids.email}),
            mech: one("mantle.party.contact.ContactMech", {contactMechId: ids.email}),
            event: one("mantle.party.communication.CommunicationEvent", {communicationEventId: ids.message}),
            entry: one("mantle.work.time.TimeEntry", {timeEntryId: ids.time}),
            otherNew: sys(() => ec.entity.find("mantle.work.time.TimeEntry").condition({partyId: OTHER, comments: "spec my hour"}).count()),
            myNew: sys(() => ec.entity.find("mantle.work.time.TimeEntry").condition({partyId: ME, comments: "spec my hour"}).count()),
            requestContent: one("mantle.request.RequestContent", {requestContentId: ids.content}),
            theirInvoice: one("mantle.account.invoice.Invoice", {invoiceId: ids.invoice})
        }
    },
    then({pcm, mech, event, entry, otherNew, myNew, requestContent, theirInvoice, newTime}) {
        pcm.thruDate == null
        mech.infoString == "spec.other@example.com"
        event.body == "Spec private body"
        entry.hours == 2
        entry.comments == "theirs"
        otherNew == 0
        newTime.errors == ""
        myNew == 1
        requestContent.requestId == ids.otherRequest
        requestContent.description == "theirs"
        theirInvoice.description == "theirs"
    }
})

feature("another party's message and request content are not shown", {
    when() {
        login(ME.toLowerCase())
        const message = request("apps/my/User/Messages/EditMessage", {communicationEventId: ids.message}, null)
        const download = request("apps/my/User/Request/EditRequest/downloadContent", {requestId: ids.myRequest, requestContentId: ids.content}, null)
        return {message, download}
    },
    then({message, download}) {
        !message.output.includes("Spec private body")
        !message.output.includes("Spec private subject")
        message.errors.includes("is not one of yours") || message.status >= 400
        !download.output.includes(SECRET)
    }
})

// an event the user made in My Calendar is theirs as its organizer (its owner; New Event makes no party row), another's is not
feature("an event the user organizes opens in EventDetail; another party's event does not", {
    when() {
        sys(() => {
            for (const [workEffortId, ownerPartyId] of [["SPEC_MAR_EVT_ME", ME], ["SPEC_MAR_EVT_OTHER", OTHER]])
                if (!one("mantle.work.effort.WorkEffort", {workEffortId}))
                    make("mantle.work.effort.WorkEffort", {workEffortId, workEffortTypeEnumId: "WetEvent", workEffortName: "Spec " + workEffortId,
                        statusId: "WeInPlanning", ownerPartyId})
        })
        login(ME.toLowerCase())
        const mine = request("apps/my/User/Calendar/EventDetail", {workEffortId: "SPEC_MAR_EVT_ME"}, null)
        const theirs = request("apps/my/User/Calendar/EventDetail", {workEffortId: "SPEC_MAR_EVT_OTHER"}, null)
        const renamed = request("apps/my/User/Calendar/EventDetail/updateEvent", {workEffortId: "SPEC_MAR_EVT_OTHER", workEffortName: "stolen"}, "post")
        return {mine, theirs, renamed, other: one("mantle.work.effort.WorkEffort", {workEffortId: "SPEC_MAR_EVT_OTHER"})}
    },
    then({mine, theirs, renamed, other}) {
        mine.errors == "" && mine.output.includes("Spec SPEC_MAR_EVT_ME")
        theirs.errors.includes("You are not a party to event SPEC_MAR_EVT_OTHER")
        !theirs.output.includes("Spec SPEC_MAR_EVT_OTHER")
        other.workEffortName == "Spec SPEC_MAR_EVT_OTHER"
    }
})
