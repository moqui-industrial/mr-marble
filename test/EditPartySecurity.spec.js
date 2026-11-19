// Marble's Edit Party screen (screen/SimpleScreens/Party/EditParty.xml, its sections included by EditCustomer and
// EditSupplier): a party's identifications are read and written through Accounting's services, never a tax identification,
// every value masked, changes only by a receivables or payables editor of an organization the party is a customer or
// supplier of (template/party/PartyIdentifications.js; plans/Security-Review.md SEC-BAP-140).
// The account's sign-in form and its enable and disable links show only to ADMIN_IDENTITY_MANAGE (SEC-ADM-89). One html
// render of Edit Party, by a user who holds none of these; the transitions posted as each user.
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

// a transition of Marble's Edit Party posted as the user with artifact authorization on, the user given Marble's root and
// Party screens (marble.xml)
function postAuthorized(username, transition, parameters) {
    login(username)
    const wasDisabled = ec.artifactExecution.authzDisabled()
    ec.artifactExecution.enableAuthz()
    try {
        const out = ec.screen.makeTest().rootScreen("component://mr-marble/screen/marble.xml").render("Party/EditParty/" + transition, parameters, "post")
        const errors = Array.from(out.errorMessages || []).join(" | ") + (ec.message.hasError() ? ec.message.getErrorsString() : "")
        ec.message.clearErrors()
        return {status: out.status, errors}
    } finally {
        if (wasDisabled) ec.artifactExecution.disableAuthz()
        login("john.doe")
    }
}
const account = userId => sys(() => ec.entity.find("moqui.security.UserAccount").condition("userId", userId).useCache(false).one())

spec({
    setupSpec() {
        login("john.doe")
        makeUser(PLAIN, [])
        for (const artifactGroupId of ["MarbleErpApp", "SimpleScreensParty"])
            make("moqui.security.ArtifactAuthz", {artifactAuthzId: PLAIN + "_" + artifactGroupId, userGroupId: PLAIN, artifactGroupId,
                authzTypeEnumId: "AUTHZT_ALLOW", authzActionEnumId: "AUTHZA_ALL"})
        makeUser(AR, ["RECEIVABLE_EDIT"])
        // the receivables editor works for the retail organization, whose customer the party is (check#CustomerScope)
        make("mantle.party.PartyRelationship", {relationshipTypeEnumId: "PrtAgent", fromPartyId: AR, toPartyId: "ORG_ZIZI_RETAIL",
            toRoleTypeId: "OrgInternal", fromDate: 0})
        make("mantle.party.Party", {partyId: PARTY, partyTypeEnumId: "PtyPerson"})
        make("mantle.party.Person", {partyId: PARTY, firstName: "Spec", lastName: "Employee"})
        make("moqui.security.UserAccount", {userId: PARTY, username: "spec.eps.party", partyId: PARTY,
            emailAddress: "spec.eps.party@example.com"})
        make("mantle.party.PartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidSsn", idValue: SSN})
        make("mantle.party.PartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidPassport", idValue: PASSPORT})
        make("mantle.party.PartyRelationship", {relationshipTypeEnumId: "PrtCustomer", fromPartyId: PARTY, toPartyId: "ORG_ZIZI_RETAIL",
            fromDate: 0})
    },
    cleanup() {
        login("john.doe")
    }
})

feature("Edit Party shows identifications masked and no tax one; only a receivables editor of the party's organization changes them, through Accounting's services (SEC-BAP-140)", {
    when() {
        login(PLAIN.toLowerCase())
        const rendered = sys(() => ec.screen.makeTest().rootScreen(root).renderMode("html").render("Party/EditParty", {partyId: PARTY}, null))
        const output = String(rendered.output || "")
        const renderErrors = Array.from(rendered.errorMessages || []).join(" | ")
        ec.message.clearErrors()
        const plainList = sys(() => ec.resource.script("component://mr-marble/template/party/PartyIdentifications.js").list(PARTY))
        login("john.doe")
        const plainChange = post(PLAIN.toLowerCase(), "updatePartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidPassport", idValue: "PLAIN1234"})
        const plainSsn = identification("PtidSsn")
        login(AR.toLowerCase())
        const arList = sys(() => ec.resource.script("component://mr-marble/template/party/PartyIdentifications.js").list(PARTY))
        login("john.doe")
        const arSsn = post(AR.toLowerCase(), "updatePartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidSsn", idValue: "999-99-9999"})
        const arMasked = post(AR.toLowerCase(), "updatePartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidPassport", idValue: "•••• 5432"})
        // a change carries the stamp the form read: with it the change is taken, and the same stamp again is stale (review)
        const read = arList[0].lastUpdatedStamp
        const arChange = post(AR.toLowerCase(), "updatePartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidPassport",
            idValue: "P11112222", lastUpdatedStamp: read})
        const arStale = post(AR.toLowerCase(), "updatePartyIdentification", {partyId: PARTY, partyIdTypeEnumId: "PtidPassport",
            idValue: "P33334444", lastUpdatedStamp: read})
        return {output, renderErrors, plainList, plainChange, plainSsn, arList, arSsn, arMasked, arChange, arStale,
            passport: identification("PtidPassport"), ssn: identification("PtidSsn")}
    },
    then({output, renderErrors, plainList, plainChange, plainSsn, arList, arSsn, arMasked, arChange, arStale, passport, ssn}) {
        renderErrors == ""
        !output.includes(SSN) && !output.includes("6789")
        !output.includes(PASSPORT)
        // a Party screen user who edits neither side sees no identification, masked or not (review)
        !output.includes("5432")
        plainList.length == 0
        // the account's sign-in form and its enable and disable links are an account administrator's (SEC-ADM-89)
        !output.includes("disableUserAccount") && !output.includes("enableUserAccount")
        !output.includes("UpdateUserAccount")
        output.includes("changed by an account administrator")
        plainChange.includes("PERMISSION_DENIED")
        plainSsn.idValue == SSN
        arList.map(row => row.partyIdTypeEnumId) == ["PtidPassport"]
        // masked for every reader, an editor too: Accounting's read (CustomerFinance.js identifications)
        arList[0].valueText == "•••• 5432"
        !JSON.stringify(arList).includes(PASSPORT)
        arSsn.includes("IDENTIFICATION_TYPE_RESTRICTED")
        arMasked.includes("IDENTIFICATION_VALUE_MASKED")
        arChange == ""
        arStale.includes("STALE_REVISION")
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

// an account's enabling and disabling is an account administrator's: a Party screen user's post, with authorization on,
// leaves it as it was (SEC-ADM-89; the framework's UserServices ask ADMIN_IDENTITY_MANAGE too once mr-moqui 8c4177a9f is merged)
feature("a Party screen user without ADMIN_IDENTITY_MANAGE disables no account (SEC-ADM-89)", {
    when() {
        const disabled = postAuthorized(PLAIN.toLowerCase(), "disableUserAccount", {userId: PARTY})
        return {disabled, after: account(PARTY)}
    },
    then({disabled, after}) {
        after.disabled != "Y"
    }
})

// a new account's group is given through Admin's access rules too (SEC-ADM-91): a Party screen user makes no account in
// a group, MarbleErpAdmin among them; MarbleErpAdmin, a registered bundle, is given on Add to Group only by ADMIN
feature("a new account's group goes through Admin's access rules; only ADMIN adds a user to MarbleErpAdmin (SEC-ADM-91)", {
    when() {
        make("mantle.party.Party", {partyId: "SPEC_EPS_NEW", partyTypeEnumId: "PtyPerson"})
        make("mantle.party.Person", {partyId: "SPEC_EPS_NEW", firstName: "Spec", lastName: "New"})
        const madeByPlain = postAuthorized(PLAIN.toLowerCase(), "createUserAccount", {partyId: "SPEC_EPS_NEW", username: "spec.eps.new",
            emailAddress: "spec.eps.new@example.com", newPassword: "Spec-eps-pass-9!", newPasswordVerify: "Spec-eps-pass-9!",
            userGroupId: "MarbleErpAdmin"})
        const newAccounts = sys(() => ec.entity.find("moqui.security.UserAccount").condition("username", "spec.eps.new").count())
        // an access administrator of an organization, not ADMIN, does not give full Marble access (review): only ADMIN does
        makeUser("SPEC_EPS_ACCESS", ["ADMIN_ACCESS_MANAGE", "ADMIN_ACCESS_VIEW"])
        const byAccessAdmin = post("spec_eps_access", "createUserGroupMember", {partyId: PARTY, userId: PARTY, userGroupId: "MarbleErpAdmin"})
        const added = post("john.doe", "createUserGroupMember", {partyId: PARTY, userId: PARTY, userGroupId: "MarbleErpAdmin"})
        const members = sys(() => ec.entity.find("moqui.security.UserGroupMember")
            .condition({userGroupId: "MarbleErpAdmin", userId: PARTY}).count())
        return {madeByPlain, newAccounts, byAccessAdmin, added, members}
    },
    then({madeByPlain, newAccounts, byAccessAdmin, added, members}) {
        newAccounts == 0
        byAccessAdmin.includes("NOT_DELEGABLE")
        added == ""
        members == 1
    }
})

// Find Duplicates' identification matches are masked and never by a tax identification (Mantle find#PartyDuplicates;
// SEC-BAP-140 review)
feature("a party's duplicates show an identification match masked and none by SSN (SEC-BAP-140)", {
    when() {
        make("mantle.party.Party", {partyId: "SPEC_EPS_TWIN", partyTypeEnumId: "PtyPerson"})
        make("mantle.party.Person", {partyId: "SPEC_EPS_TWIN", firstName: "Spec", lastName: "Twin"})
        make("mantle.party.PartyIdentification", {partyId: "SPEC_EPS_TWIN", partyIdTypeEnumId: "PtidSsn", idValue: SSN})
        make("mantle.party.PartyIdentification", {partyId: "SPEC_EPS_TWIN", partyIdTypeEnumId: "PtidPassport",
            idValue: identification("PtidPassport").idValue})
        const found = sys(() => ec.service.sync().name("mantle.party.DuplicateServices.find#PartyDuplicates").parameters({partyId: PARTY}).call())
        return {matches: Array.from(found.matchingInfoByPartyId?.SPEC_EPS_TWIN || []), passport: identification("PtidPassport").idValue}
    },
    then({matches, passport}) {
        matches.some(row => row.matchType == "identification")
        !JSON.stringify(matches).includes(SSN) && !JSON.stringify(matches).includes(passport)
        !matches.some(row => row.partyIdTypeEnumId == "PtidSsn")
    }
})
