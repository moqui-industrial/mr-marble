// The git screens of projects and tasks (Project/EditRepositories, ProjectSummary, Project/GitCommit, Task/EditSource,
// Task/TaskSummary), My Account's Git Access, and the tools repository detail, on a project with a database repository
// whose commit names a task. New spec, no Groovy original.
const PROJECT = "GITS"
let screens, my, tools, taskId, commitId

spec({
    requires: ["git"],
    stepwise: true,
    setupSpec() {
        login("john.doe")
        screens = ec.screen.makeTest().rootScreen("component://mr-marble/screen/SimpleScreens.xml")
        my = screenTest("apps/my")
        tools = screenTest("apps/system")
    },
    setup() { ec.artifactExecution.disableAuthz() },
    cleanup() { ec.artifactExecution.enableAuthz() },
})

// wait for the gitECA rules of the repository's updates (they run on the git pool after each commit)
function settle(repositoryId) {
    const started = Date.now()
    while (Date.now() - started < 20000) {
        const busy = ["recording", "pending", "running"].reduce((sum, ecaStatus) =>
            sum + ec.entity.find("moqui.resource.GitUpdate").condition({ repositoryId, ecaStatus }).count(), 0)
        if (busy == 0) return
        call("org.moqui.impl.GitServices.process#PendingGitUpdates", {})
    }
    throw new Error("the git updates did not settle")
}

function rendered(test, screenPath, params) {
    const out = []
    for (const renderMode of ["html", "qvt"]) {
        // the screen alone: a qvt render from the root is the shell, which loads the screen in the browser
        const str = test.render(screenPath, Object.assign({ renderMode, lastStandalone: "true" }, params ?? {}), null)
        out.push({ renderMode, status: str.status, errors: str.errorMessages.join("; "), output: str.output ?? "" })
    }
    return out
}

feature("a project with a repository, a task and a commit that names it", {
    when() {
        call("mantle.work.ProjectServices.create#Project", { workEffortId: PROJECT, workEffortName: "Git Screens" })
        taskId = call("mantle.work.TaskServices.create#Task", { rootWorkEffortId: PROJECT, workEffortName: "Show commits" })
            .workEffortId
        call("mantle.work.GitServices.create#ProjectRepository", { workEffortId: PROJECT, repositoryKind: "db" })
        commitId = call("org.moqui.impl.GitServices.commit#GitFiles", { repositoryId: "gits",
            message: `Show the commits of ${taskId}`, fileMap: { "README.md": "# Git screens\nline two\n" } }).commitId
        settle("gits")
        return { links: ec.entity.find("mantle.work.effort.WorkEffortGitCommit").condition({ workEffortId: taskId }).count() }
    },
    then({ links }) {
        commitId.length == 40
        links == 1
    },
})

// the parameters and expected texts of each screen, read when the feature runs (the where rows are built at load)
function screenCase(screenPath) {
    const short = commitId.substring(0, 10)
    return {
        "Project/EditRepositories": { params: { rootWorkEffortId: PROJECT }, texts: ["gits", "/git/gits.git"] },
        "Project/ProjectSummary": { params: { workEffortId: PROJECT }, texts: ["gits", "Complete/Closed - 0", "Provider Cost"] },
        "Project/GitCommit": { params: { repositoryId: "gits", commitId }, texts: [`Show the commits of ${taskId}`, "README.md",
            "moqui-diff"] },
        "Task/EditSource": { params: { workEffortId: taskId }, texts: [short] },
        "Task/TaskSummary": { params: { workEffortId: taskId }, texts: [short, `Show the commits of ${taskId}`] },
    }[screenPath]
}

feature("render #screenPath", {
    where: [
        { screenPath: "Project/EditRepositories" },
        { screenPath: "Project/ProjectSummary" },
        { screenPath: "Project/GitCommit" },
        { screenPath: "Task/EditSource" },
        { screenPath: "Task/TaskSummary" },
    ],
    expect({ screenPath }) {
        const { params, texts } = screenCase(screenPath)
        const renders = rendered(screens, screenPath, params)
        renders.map((it) => [it.renderMode, it.status, it.errors]) == [["html", 200, ""], ["qvt", 200, ""]]
        texts.filter((text) => !renders.every((it) => it.output.includes(text))) == []
    },
})

feature("Git Access shows a new access token once and lists SSH keys", {
    expect() {
        const created = my.render("User/GitAccess/createAccessToken", { description: "laptop" }, "post")
        created.errorMessages.length == 0
        const first = my.render("User/GitAccess", null, null)
        first.errorMessages.length == 0
        first.output.includes("shown only now")
        first.output.includes("laptop")
        const again = my.render("User/GitAccess", null, null)
        !again.output.includes("shown only now")
        rendered(my, "User/GitAccess", null).map((it) => it.errors) == ["", ""]
    },
})

feature("the tools repository detail shows clone URLs, refs, commits and updates", {
    expect() {
        const renders = rendered(tools, "Resource/GitRepositoryDetail", { repositoryId: "gits" })
        renders.map((it) => [it.status, it.errors]) == [[200, ""], [200, ""]]
        renders.every((it) => it.output.includes("/git/gits.git") && it.output.includes(`Show the commits of ${taskId}`))
    },
})
