// My Account's second factors: the list shows each factor's type, dates and email or phone destination, and never the
// secret of an authenticator app (the factor's factorOption), not even in the page's data.

const webroot = "component://webroot/screen/webroot.xml"
const USER = "EX_JOHN_DOE"
let factorId = null

spec({ setupSpec() { login("john.doe") } })

feature("the factor list of My Account carries no authenticator secret", {
    when() {
        const sys = (run) => {
            const disabled = ec.artifactExecution.disableAuthz()
            try { return run() } finally { if (!disabled) ec.artifactExecution.enableAuthz() }
        }
        const factor = sys(() => ec.service.sync().name("org.moqui.impl.UserServices.create#UserAuthcFactorTotp").parameters({ userId: USER }).call())
        factorId = factor.factorId
        const str = ec.screen.makeTest().rootScreen(webroot).renderMode("qvt").withStaticData()
            .render("apps/my/User/Account", { lastStandalone: "true" }, null)
        const output = String(str.output || "")
        const errors = str.errorMessages.join(" | ")
        ec.message.clearErrors()
        // Only booleans leave the test: a failure must not print the disposable secret either.
        return { status: str.status, errors, created: !!factor.factorOption, listed: output.includes("Factor Type") && output.includes(factor.factorId),
            secretAbsent: !!factor.factorOption && !output.includes(factor.factorOption),
            broken: /Error rendering|Exception in render/.test(output) }
    },
    then({ status, errors, created, listed, secretAbsent, broken }) {
        errors == ""
        status == 200
        !broken
        created == true
        listed == true
        secretAbsent == true
    },
    cleanup() {
        const disabled = ec.artifactExecution.disableAuthz()
        try { if (factorId) ec.entity.find("moqui.security.UserAuthcFactor").condition("factorId", factorId).deleteAll() }
        finally { if (!disabled) ec.artifactExecution.enableAuthz() }
        factorId = null
    },
})
