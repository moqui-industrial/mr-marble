// Marble's Accounting Preferences (Accounting/OrgSettings/AcctgPreference updatePartyAcctgPreference, an entity-auto update)
// keeps self approval as stored for a user without ACCOUNTING_SELF_APPROVAL, as Mantle's store#Preferences turns it on only for a
// holder (plans/Security-Review-Low.md SEC-BOS-06); john.doe (ADMIN) holds it. Run: ./moq test mr-marble --spec AcctgPreferenceSelfApproval
const ORG = "SPEC_APSA_ORG",
    USER = "SPEC_APSA_USER"
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
const selfApproval = () =>
    sys(() => ec.entity.find("mantle.ledger.config.PartyAcctgPreference").condition("organizationPartyId", ORG).useCache(false).one())
        ?.allowAccountingSelfApproval
// the transition posted as the user, artifact authorization off (the rule is the transition's own)
function post(username, value) {
    login(username)
    try {
        sys(() =>
            ec.screen
                .makeTest()
                .rootScreen(root)
                .render("Accounting/OrgSettings/AcctgPreference/updatePartyAcctgPreference", {partyId: ORG, organizationPartyId: ORG,
                    allowAccountingSelfApproval: value}, "post")
        )
        ec.message.clearErrors()
    } finally {
        login("john.doe")
    }
    return selfApproval()
}

spec({
    setupSpec() {
        login("john.doe")
        make("mantle.party.Party", {partyId: ORG, partyTypeEnumId: "PtyOrganization"})
        make("mantle.ledger.config.PartyAcctgPreference", {organizationPartyId: ORG, baseCurrencyUomId: "USD", allowAccountingSelfApproval: "N"})
        make("mantle.party.Party", {partyId: USER, partyTypeEnumId: "PtyPerson"})
        make("moqui.security.UserAccount", {userId: USER, username: USER.toLowerCase(), partyId: USER,
            currentPassword: "16ac58bbfa332c1c55bd98b53e60720bfa90d394", passwordHashType: "SHA"})
    },
    cleanup() {
        login("john.doe")
    }
})

feature("a user without ACCOUNTING_SELF_APPROVAL does not turn self approval on from Marble; ADMIN does", {
    when() {
        return {plain: post(USER.toLowerCase(), "Y"), admin: post("john.doe", "Y")}
    },
    then({plain, admin}) {
        plain == "N"
        admin == "Y"
    }
})
