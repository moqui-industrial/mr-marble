// A party's identifications on Marble's Party, Customer and Supplier screens (SEC-BAP-140), read and written through
// Accounting's own services: read through Mantle account/CustomerFinance.js identifications (never a tax identification,
// SSN, FEIN or FUID, and every value masked to its last four characters), written through
// CustomerFinanceServices.xml store#CustomerIdentification (RECEIVABLE_EDIT in an organization the party is a customer of,
// PAYABLE_EDIT for a supplier's; never a tax type or a masked value; check#CustomerScope refuses an employee, whose
// identifications are People's, and an internal organization). A removal asks the same scope. CC0 plus patent grant.
const finance = ec.resource.script("component://mr-mantle/service/mantle/account/CustomerFinance.js")
const taxIdTypes = Array.from(finance.taxIdTypes)
const sync = name => ec.service.sync().name(name)

// The section's rows, masked (valueText), with an empty idValue for the edit form's new value: only for the editor Accounting
// and Customer Service show them to (RECEIVABLE_EDIT for a customer, PAYABLE_EDIT for a supplier, of one of the user's
// organizations: scopeFor), never for an employee or to every Party screen user (SEC-BAP-140 review).
function list(partyId) {
    if (!partyId || !scopeFor(partyId)) return []
    const wasDisabled = ec.artifactExecution.disableAuthz()
    try {
        return Array.from(finance.execute("identifications", {partyId}).identifications || []).map(row =>
            Object.assign({}, row, {idValue: "", valueText: row.valueText})
        )
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
}
// The organization and side the user changes the party's identifications in: the first of the user's organizations (the
// active one first) whose customer (RECEIVABLE_EDIT) or supplier (PAYABLE_EDIT) the party is, as check#CustomerScope admits
// it; null when none. Kept for the request.
function scopeFor(partyId) {
    if (!partyId) return null
    const memo = ec.context.get("identificationScopeMemo") || {}
    if (!ec.context.get("identificationScopeMemo")) ec.context.put("identificationScopeMemo", memo)
    // kept by user too: the user can change within one context (a sign-in, a test's login)
    const key = (ec.user.userId || "") + "|" + partyId
    if (key in memo) return memo[key]
    const info = sync("mantle.party.PartyServices.get#PartyOrganizationInfo").disableAuthz().call() || {}
    const organizations = Array.from(info.userOrgIds || [])
    if (info.activeOrgId && organizations.includes(info.activeOrgId))
        organizations.sort((a, b) => (a === info.activeOrgId ? -1 : b === info.activeOrgId ? 1 : 0))
    let found = null
    for (const [side, permission] of [["customer", "RECEIVABLE_EDIT"], ["supplier", "PAYABLE_EDIT"]]) {
        if (found || !ec.user.hasPermission(permission)) continue
        for (const organizationPartyId of organizations) {
            ec.message.pushErrors()
            try {
                sync("mantle.account.CustomerFinanceServices.check#CustomerScope")
                    .parameters({organizationPartyId, customerPartyId: partyId, side, permission})
                    .disableAuthz()
                    .call()
                if (!ec.message.hasError()) found = {organizationPartyId, side}
            } catch (error) {
                // not this organization's customer or supplier
            } finally {
                ec.message.clearErrors()
                ec.message.popErrors()
            }
            if (found) break
        }
    }
    memo[key] = found
    return found
}
const canEdit = partyId => !!scopeFor(partyId)
function refuse(message) {
    ec.message.addError(message)
    return false
}
// create (update false) or change (update true) of one identification, through store#CustomerIdentification
function store(p, update) {
    const scope = scopeFor(p.partyId)
    if (!scope) return refuse("PERMISSION_DENIED: Identifications are changed by a receivables or payables editor of the party's organization")
    const existing = ec.entity
        .find("mantle.party.PartyIdentification")
        .condition({partyId: p.partyId, partyIdTypeEnumId: p.partyIdTypeEnumId || "_NONE_"})
        .disableAuthz()
        .one()
    if (update && !existing) return refuse("RECORD_UNAVAILABLE: No such identification")
    if (!update && existing) return refuse("IDENTIFICATION_EXISTS: The party has an identification of this type")
    const parameters = {
        organizationPartyId: scope.organizationPartyId,
        customerPartyId: p.partyId,
        side: scope.side,
        partyIdTypeEnumId: p.partyIdTypeEnumId,
        // the stamp the form read, so a change made since is refused (STALE_REVISION), never the row's current one
        lastUpdatedStamp: update ? p.lastUpdatedStamp || null : null
    }
    if (p.idValue) parameters.idValue = p.idValue
    if ("expireDate" in p) parameters.expireDate = p.expireDate || null
    sync("mantle.account.CustomerFinanceServices.store#CustomerIdentification").parameters(parameters).call()
}
function remove(p) {
    const scope = scopeFor(p.partyId)
    if (!scope) return refuse("PERMISSION_DENIED: Identifications are changed by a receivables or payables editor of the party's organization")
    if (taxIdTypes.includes(p.partyIdTypeEnumId))
        return refuse("IDENTIFICATION_TYPE_RESTRICTED: Tax identifications are kept in payroll and tax setup")
    sync("delete#mantle.party.PartyIdentification")
        .parameters({partyId: p.partyId, partyIdTypeEnumId: p.partyIdTypeEnumId})
        .disableAuthz()
        .call()
}
;({taxIdTypes, canEdit, list, store, remove})
