// Whether Marble's screens show or change a record, by Mantle's rule for it inside the user's organizations (Mantle
// search/SearchScope.js hitHidden, the universal search's per-hit rule; plans/Security-Review.md SEC-DAT-98): a confidential
// HR case, a maintenance request or work order outside the user's Maintenance reach, a protected People task, a confidential
// Smithy issue's task and a person who is only an applicant are kept from the user. Each answer is kept for the request
// (ec.context), as a transition and its screen ask it of the same record. CC0 plus patent grant.
const scope = ec.resource.script("component://mr-mantle/service/mantle/search/SearchScope.js")
const entities = {MantleRequest: ["mantle.request.Request", "requestId"], MantleTask: ["mantle.work.effort.WorkEffort", "workEffortId"],
    MantleParty: ["mantle.party.Party", "partyId"]}
function hidden(documentId, id) {
    if (!id) return false
    const memo = ec.context.get("recordScopeMemo") || {}
    if (!ec.context.get("recordScopeMemo")) ec.context.put("recordScopeMemo", memo)
    // kept by user too: the user can change within one context (a sign-in, a test's login)
    const key = (ec.user.userId || "") + "|" + documentId + ":" + id
    if (key in memo) return memo[key]
    const [entity, field] = entities[documentId]
    const wasDisabled = ec.artifactExecution.disableAuthz()
    let answer
    try {
        const row = ec.entity.find(entity).condition(field, id).one()
        answer = !!row && scope.hitHidden(documentId, row, ec.user.userAccount?.partyId || null)
    } finally {
        if (!wasDisabled) ec.artifactExecution.enableAuthz()
    }
    memo[key] = answer
    return answer
}
const requestHidden = requestId => hidden("MantleRequest", requestId)
const taskHidden = workEffortId => hidden("MantleTask", workEffortId)
const partyHidden = partyId => hidden("MantleParty", partyId)
;({requestHidden, taskHidden, partyHidden})
