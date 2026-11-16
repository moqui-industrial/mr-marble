// Party › Payment Methods (screen/SimpleScreens/Party/EditParty.xml, its UpdatePaymentMethodInfo dialog with
// template/party/PartyForms.xml#PaymentMethodInfo): the list shows a bank account's number masked; the edit form has the
// whole number in its input only for the owner's own user or a holder of PAYMENT_NUMBER_VIEW (get#PartyPaymentMethodInfo
// fullNumbers; john.doe holds it through ADMIN), anyone else sees it masked and sends none (mr-moqui
// plans/Security-Review-Low.md SEC-BAP-04). Who gets fullNumbers is Mantle's rule, tested in Mantle PaymentMethodServices.
// Run: ./moq test mr-marble --spec PaymentMethodForm
const webroot = "component://webroot/screen/webroot.xml"
const PARTY = "CustJqp"
let bankId

spec({
    setupSpec() {
        login("john.doe")
        const already = ec.artifactExecution.disableAuthz()
        try {
            bankId = ec.service.sync().name("mantle.account.PaymentMethodServices.create#BankAccount").parameters({ ownerPartyId: PARTY,
                bankName: "Spec Form Bank", routingNumber: "021000021", accountNumber: "000246813579", typeEnumId: "BatChecking" })
                .call().paymentMethodId
        } finally { if (!already) ec.artifactExecution.enableAuthz() }
    },
    cleanupSpec() {
        const already = ec.artifactExecution.disableAuthz()
        try {
            ec.service.sync().name("mantle.account.PaymentMethodServices.delete#PaymentMethod").parameters({ paymentMethodId: bankId }).call()
        } finally { if (!already) ec.artifactExecution.enableAuthz() }
    },
})

feature("the edit form of a bank account has the whole number for a holder of PAYMENT_NUMBER_VIEW; the party's list shows it masked", {
    when() {
        const form = ec.screen.makeTest().rootScreen(webroot)
            .render("apps/marble/Party/EditParty/UpdatePaymentMethodInfo", { partyId: PARTY, paymentMethodId: bankId }, "get")
        const page = ec.screen.makeTest().rootScreen(webroot).render("apps/marble/Party/EditParty", { partyId: PARTY }, "get")
        return { form, page }
    },
    then({ form, page }) {
        form.errorMessages.length == 0
        form.output.includes("000246813579")
        page.errorMessages.length == 0
        page.output.includes("•••• 3579")
        !page.output.includes("000246813579")
    },
})
