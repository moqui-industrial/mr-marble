// Port of src/test/groovy/MyAccountScreenTests.groovy: the My Account screens (apps/my) as the worker user.
const effectiveTime = Date.now()
let screens

spec({
    // the worker user and expense invoice 55900 come from WorkPlanToCashBasicFlow
    dependsOn: ["WorkPlanToCashBasicFlow"],
    tempSequences: { start: 61000, banks: {
        "mantle.party.communication.CommunicationEvent": 10,
        "mantle.work.effort.WorkEffort": 10 } },
    setupSpec() {
        login("worker", "moqui1!!")
        screens = screenTest("apps/my")
    },
    cleanupSpec() {
        log.info(`Rendered ${screens.renderCount} screens (${screens.errorCount} errors) in ${(Date.now() - screens.startTime) / 1000}s, output ${Math.round(screens.renderTotalChars / 1000)}k chars`)
    },
    setup() { ec.artifactExecution.disableAuthz() },
    cleanup() { ec.artifactExecution.enableAuthz() },
})

feature("single-use codes survive the redirect as whole codes and display only once", {
    expect() {
        const created = screens.render("User/Account/createUserAuthcFactorSingleUse", { numberOfCodes: "6" }, "post")
        !created.errorMessages.length
        created.status == 302
        const account = screens.render("User/Account", null, null)
        !account.errorMessages.length
        account.assertContains('Write down these codes. They will only appear once.')
        const codes = [...account.output.matchAll(/class="text-danger"[^>]*>(\d{8})</g)].map(it => it[1])
        codes.length == 6
        new Set(codes).size == 6
        const again = screens.render("User/Account", null, null)
        !again.errorMessages.length
        again.assertNotContains('Write down these codes. They will only appear once.')
        codes.every(code => !again.output.includes(code))
    },
})

feature("render My Account screen (#screenPath, #containsTextList)", {
    where: [
        { screenPath: "User/Messages/FindMessage/createMessage?toPartyId=ORG_BLUTH_GOB&subject=Screen Test Subject&body=Screen Test Body", containsTextList: [] },
        { screenPath: "User/Messages/FindMessage", containsTextList: ['Screen Test Subject'] },
        { screenPath: "User/Messages/MessageThread?communicationEventId=61000", containsTextList: ['Screen Test Subject'] },
        { screenPath: "User/Messages/MessageThread/SingleMessage?communicationEventId=61000", containsTextList: ['Screen Test Subject', 'Screen Test Body'] },

        { screenPath: "User/Calendar", containsTextList: ['New Event'] },
        { screenPath: `User/Calendar/MyCalendar/createEvent?workEffortName=Screen Test Event&purposeEnumId=WepMeeting&estimatedStartDate=${effectiveTime}&estimatedWorkDuration=2`, containsTextList: [] },
        { screenPath: "User/Calendar/EventDetail?workEffortId=61000", containsTextList: ['Screen Test Event', 'Meeting'] },

        { screenPath: "User/Task/MyTasks/createTask?purposeEnumId=WepTask&estimatedWorkTime=3&workEffortName=Screen Test Task&description=Screen Test Description", containsTextList: [] },
        { screenPath: "User/Task/MyTasks", containsTextList: ['61001', 'Screen Test Task', 'In Planning'] },
        { screenPath: "User/Task/TaskDetail?workEffortId=61001", containsTextList: ['Screen Test Task', 'Screen Test Description', 'In Planning', 'Test Worker'] },

        { screenPath: "User/TimeEntries/recordTimeEntry?workEffortId=61001&rateTypeEnumId=RatpStandard&emplPositionClassId=Programmer&hours=3&pieceCount=150&workTypeEnumId=WktpGeneralOffice&facilityId=ZIRET_WH", containsTextList: [] },
        { screenPath: "User/TimeEntries", containsTextList: ['Screen Test Task', 'Standard', '3.00'] },
        { screenPath: "User/ContactInfo", containsTextList: ['Email Addresses', 'Phone Numbers'] },
        { screenPath: "User/Account", containsTextList: ['worker@test.com', 'Worker', 'Change Password'] },

        { screenPath: "Expense/FindExpenseInvoice", containsTextList: ['Test Vendor', 'Billed Through'] },
        { screenPath: "Expense/EditExpenseInvoice?invoiceId=55900", containsTextList: ['Test Worker', 'Billed Through', '1009.12'] },
        { screenPath: "Expense/EditExpenseInvoiceItems?invoiceId=55900", containsTextList: ['Travel Air', 'United SFO-LAX', 'Time Entry', '240.00'] },
    ],
    expect({ screenPath, containsTextList }) {
        const str = screens.render(screenPath, null, null)
        let containsAll = true
        for (const containsText of containsTextList) {
            if (containsText && !str.assertContains(containsText)) {
                log.info(`In ${screenPath} text [${containsText}] not found:\n${str.output}`)
                containsAll = false
            }
        }

        !str.errorMessages.length
        containsAll
    },
})
