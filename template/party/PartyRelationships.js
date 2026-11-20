// A party relationship made or changed on Marble's Party, Customer and Vendor screens. An organization's parent (PrtOrgRollup)
// is Mantle's organization structure, which printers, ledgers and party reach read as one family: it is set only through
// IdentityServices.store#OrganizationParent (ADMIN_SETTINGS_MANAGE, both organizations internal and in the user's scope), and
// a rollup is never changed here, nor another relationship turned into one (SEC-BAP-103 review). Any other relationship is
// written as before. CC0 plus patent grant.
const ROLLUP = "PrtOrgRollup"
const sync = name => ec.service.sync().name(name)
function refuse(message) {
    ec.message.addError(message)
    return null
}
function create(p) {
    if (p.relationshipTypeEnumId !== ROLLUP) return sync("create#mantle.party.PartyRelationship").parameters(p).call()
    const out =
        sync("mantle.party.IdentityServices.store#OrganizationParent")
            .parameters({organizationPartyId: p.fromPartyId, parentPartyId: p.toPartyId, fromDate: p.fromDate || null})
            .call() || {}
    if (!ec.message.hasError() && out.applied === false)
        return refuse((out.reasonCode || "REFUSED") + ": " + (out.reason || "The organization's parent was not set"))
    return out
}
function update(p) {
    const existing = p.partyRelationshipId
        ? ec.entity.find("mantle.party.PartyRelationship").condition("partyRelationshipId", p.partyRelationshipId).disableAuthz().one()
        : null
    if (existing?.relationshipTypeEnumId === ROLLUP || p.relationshipTypeEnumId === ROLLUP)
        return refuse("RELATIONSHIP_RESTRICTED: An organization's parent is changed in Admin's organizations")
    return sync("update#mantle.party.PartyRelationship").parameters(p).call()
}
;({create, update})
