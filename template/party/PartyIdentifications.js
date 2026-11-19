// A party's identifications on Marble's Party, Customer and Supplier screens (SEC-BAP-140), with Accounting's rule (Mantle
// account/CustomerFinance.js and CustomerFinanceServices.xml store#CustomerIdentification): a tax identification (SSN, FEIN,
// FUID: payroll's and tax setup's) is never read or written here; a holder of RECEIVABLE_EDIT or PAYABLE_EDIT (the
// permissions Accounting writes identifications under) reads the other values whole and writes them, never a masked value;
// anyone else reads them masked to their last four characters and writes none. CC0 plus patent grant.
const finance = ec.resource.script("component://mr-mantle/service/mantle/account/CustomerFinance.js")
const taxIdTypes = Array.from(finance.taxIdTypes)
const masked = value => (value ? "•••• " + String(value).slice(-4) : "")
const canEdit = () => ec.user.hasPermission("RECEIVABLE_EDIT") || ec.user.hasPermission("PAYABLE_EDIT")
const find = entity => ec.entity.find(entity).disableAuthz()

// The section's rows: the party's identifications but the tax ones, whole for an editor and masked for anyone else.
function list(partyId) {
    const editor = canEdit()
    return Array.from(
        find("mantle.party.PartyIdentification")
            .condition("partyId", partyId || "_NONE_")
            .condition("partyIdTypeEnumId", "not-in", taxIdTypes)
            .orderBy("partyIdTypeEnumId")
            .limit(100)
            .list()
    ).map(row => Object.assign(row.getMap(), {idValue: editor ? row.idValue : masked(row.idValue)}))
}
function refuse(message) {
    ec.message.addError(message)
    return false
}
function allowed(p) {
    if (!canEdit()) return refuse("PERMISSION_DENIED: RECEIVABLE_EDIT or PAYABLE_EDIT is required to change an identification")
    if (!p.partyId || !p.partyIdTypeEnumId) return refuse("IDENTIFICATION_TYPE_INVALID: Choose an identification type")
    // the party itself as the entity filters read it for the user (another organization's party answers as missing)
    if (!ec.entity.find("mantle.party.Party").condition("partyId", p.partyId).one())
        return refuse("RECORD_UNAVAILABLE: Party " + p.partyId + " is not available")
    const type = find("moqui.basic.Enumeration").condition("enumId", p.partyIdTypeEnumId).useCache(true).one()
    if (type?.enumTypeId !== "PartyIdType") return refuse("IDENTIFICATION_TYPE_INVALID: Choose an identification type")
    if (taxIdTypes.includes(p.partyIdTypeEnumId))
        return refuse("IDENTIFICATION_TYPE_RESTRICTED: Tax identifications are kept in payroll and tax setup")
    return true
}
// create (update false) or change (update true) of one identification
function store(p, update) {
    if (!allowed(p)) return
    if (p.idValue && String(p.idValue).includes("•"))
        return refuse("IDENTIFICATION_VALUE_MASKED: Enter the whole identification, not its masked form")
    const existing = find("mantle.party.PartyIdentification")
        .condition({partyId: p.partyId, partyIdTypeEnumId: p.partyIdTypeEnumId})
        .one()
    if (update && !existing) return refuse("RECORD_UNAVAILABLE: No such identification")
    if (!update && existing) return refuse("IDENTIFICATION_EXISTS: The party has an identification of this type")
    const fields = {partyId: p.partyId, partyIdTypeEnumId: p.partyIdTypeEnumId}
    if (!update || p.idValue) fields.idValue = p.idValue || null
    if ("expireDate" in p) fields.expireDate = p.expireDate || null
    ec.service
        .sync()
        .name((update ? "update" : "create") + "#mantle.party.PartyIdentification")
        .parameters(fields)
        .disableAuthz()
        .call()
}
function remove(p) {
    if (!allowed(p)) return
    ec.service
        .sync()
        .name("delete#mantle.party.PartyIdentification")
        .parameters({partyId: p.partyId, partyIdTypeEnumId: p.partyIdTypeEnumId})
        .disableAuthz()
        .call()
}
;({taxIdTypes, canEdit, list, store, remove})
