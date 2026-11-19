// Marble's Edit Party screen (screen/SimpleScreens/Party/EditParty.xml, its sections included by EditCustomer and
// EditSupplier): a party's identifications follow Accounting's rule, never a tax identification and whole values and changes
// only for RECEIVABLE_EDIT or PAYABLE_EDIT (template/party/PartyIdentifications.js; plans/Security-Review.md SEC-BAP-140).
// One html render of Edit Party, by a user who holds neither; the transitions posted as each user.
// Run: ./moq test mr-marble --spec EditPartySecurity
const PARTY = "SPEC_EPS_PARTY"
const PLAIN = "SPEC_EPS_PLAIN"
const AR = "SPEC_EPS_AR"
const SSN = "123-45-6789"
const PASSPORT = "P98765432"
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
function makeUser(userId, permissions) {
    make("mantle.party.Party", {partyId: userId, partyTypeEnumId: "PtyPerson"})
    make("mantle.party.Person", {partyId: userId, firstName: "Spec", lastName: userId})
    make("moqui.security.UserAccount", {userId, username: userId.toLowerCase(), partyId: userId,
        currentPassword: "16ac58bbfa332c1c55bd98b53e60720bfa90d394", passwordHashType: "SHA"})
    make("moqui.security.UserGroup", {userGroupId: userId, description: "Spec " + userId})
    for (const userPermissionId of permissions)
        make("moqui.security.UserGroupPermission", {userGroupId: userId, userPermissionId, fromDate: 0})
    make("moqui.security.UserGroupMember", {userGroupId: userId, userId, fromDate: 0})
}
const identification = type =>
    sys(() => ec.entity.find("mantle.party.PartyIdentification").condition({partyId: PARTY, partyIdTypeEnumId: type}).useCache(false).one())
// a transition of Edit Party posted as the user, artifact authorization off (the rules are the transitions' own)
function post(username, transition, parameters) {
    login(username)
    try {
        const out = sys(() => ec.screen.makeTest().rootScreen(root).render("Party/EditParty/" + transition, parameters, "post"))
        const errors = Array.from(out.errorMessages || []).join(" | ") + (ec.message.hasError() ? ec.message.getErrorsString() : "")
        ec.message.clearErrors()
        return errors
    } finally {
        login("john.doe")
    }
}

spec({
    setupSpec() {
        login("john.doe")
        makeUser(PLAIN, [])
        makeUser(AR, ["RECEIVABLE_EDIT"])
        make("mantle.party.Party", {partyId: PARTY, partyTypeEnumId: "PtyPerson"})
        make("mantle.party.Person", {partyId: PARTY, firstName: "Spec", lastName: "Employee"})
        make("moqui.security.UserAccount", {userId: PARTY, username: "spec.eps.party", partyId: PARTY,
            emailAddress: "spec.eps.party@example.com"})
        make("mantle.party.PartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidSsn", idValue: SSN})
        make("mantle.party.PartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidPassport", idValue: PASSPORT})
    },
    cleanup() {
        login("john.doe")
    }
})

feature("Edit Party shows identifications masked and no tax one; only a receivables editor reads them whole and changes them (SEC-BAP-140)", {
    when() {
        login(PLAIN.toLowerCase())
        const rendered = sys(() => ec.screen.makeTest().rootScreen(root).renderMode("html").render("Party/EditParty", {partyId: PARTY}, null))
        const output = String(rendered.output || "")
        const renderErrors = Array.from(rendered.errorMessages || []).join(" | ")
        ec.message.clearErrors()
        login("john.doe")
        const plainChange = post(PLAIN.toLowerCase(), "updatePartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidPassport", idValue: "PLAIN1234"})
        const plainSsn = identification("PtidSsn")
        login(AR.toLowerCase())
        const arList = sys(() => ec.resource.script("component://mr-marble/template/party/PartyIdentifications.js").list(PARTY))
        login("john.doe")
        const arSsn = post(AR.toLowerCase(), "updatePartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidSsn", idValue: "999-99-9999"})
        const arMasked = post(AR.toLowerCase(), "updatePartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidPassport", idValue: "•••• 5432"})
        const arChange = post(AR.toLowerCase(), "updatePartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidPassport", idValue: "P11112222"})
        return {output, renderErrors, plainChange, plainSsn, arList, arSsn, arMasked, arChange,
            passport: identification("PtidPassport"), ssn: identification("PtidSsn")}
    },
    then({output, renderErrors, plainChange, plainSsn, arList, arSsn, arMasked, arChange, passport, ssn}) {
        renderErrors == ""
        !output.includes(SSN) && !output.includes("6789")
        !output.includes(PASSPORT)
        output.includes("5432")
        plainChange.includes("PERMISSION_DENIED")
        plainSsn.idValue == SSN
        arList.map(row => row.partyIdTypeEnumId) == ["PtidPassport"]
        arList[0].idValue == PASSPORT
        arSsn.includes("IDENTIFICATION_TYPE_RESTRICTED")
        arMasked.includes("IDENTIFICATION_VALUE_MASKED")
        arChange == ""
        passport.idValue == "P11112222"
        ssn.idValue == SSN
    }
})

// a security group membership is given and ended through Admin's access rules (store#Membership, end#Membership), never a
// write of the row (SEC-ADM-91): a Party screen user adds no account to a group, their own included
feature("Edit Party's group membership goes through Admin's access rules: a user without ADMIN_ACCESS_MANAGE adds no account to a group (SEC-ADM-91)", {
    when() {
        make("moqui.security.UserGroup", {userGroupId: "SPEC_EPS_GROUP", description: "Spec unprivileged group"})
        const own = post(PLAIN.toLowerCase(), "createUserGroupMember", {partyId: PLAIN, userId: PLAIN, userGroupId: "SPEC_EPS_GROUP"})
        const other = post(PLAIN.toLowerCase(), "createUserGroupMember", {partyId: PARTY, userId: PARTY, userGroupId: "SPEC_EPS_GROUP"})
        const members = sys(() => ec.entity.find("moqui.security.UserGroupMember").condition("userGroupId", "SPEC_EPS_GROUP").count())
        return {own, other, members}
    },
    then({own, other, members}) {
        own.includes("ADMIN_ACCESS_MANAGE")
        other.includes("ADMIN_ACCESS_MANAGE")
        members == 0
    }
})
