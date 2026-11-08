# MR Marble - Marble ERP and Simple Screens for MR Moqui

[![license](http://img.shields.io/badge/license-CC0%201.0%20Universal-blue.svg)](https://github.com/moqui/mr-marble/blob/master/LICENSE.md)

[![Discourse Forum](https://img.shields.io/badge/moqui%20forum-discourse-blue.svg)](https://forum.moqui.org)

The Marble ERP application and the Simple Screens library it is built from, for
[MR Moqui](https://github.com/moqui/mr-moqui), in one component named `mr-marble` that depends on `mr-mantle`:

- **Simple Screens**: a library of screens and screen components (forms, sections, transitions) to be included,
  extended, or generally reused in applications based on MR Moqui and Mantle. They are under `screen/SimpleScreens/`
  (`component://mr-marble/screen/SimpleScreens/...`), with `template/`, and My Account (`/apps/my`). From the Java Moqui
  component [SimpleScreens](https://github.com/moqui/SimpleScreens).
- **Marble ERP**: a planning and management application for businesses that produce goods and services, and sell to
  individuals (B2C) and organizations (B2B). Its shell and dashboard are `screen/marble.xml` and `screen/marble/`,
  mounted at `/apps/marble` (HTML) and `/qapps/marble` (QVT); most of its screens are mounted from Simple Screens. From
  the Java Moqui component [MarbleERP](https://github.com/moqui/MarbleERP).

The two were ported in the forks `MrSimpleScreens` and `MrMarbleERP` (Groovy and FreeMarker to JavaScript, XSL-FO to
HTML print), then merged into this repository with the commit history of both. The renames from the Java names are in
the MR Moqui `docs/dev/Moqui-Java-Migration.md`; the port is recorded in [MIGRATION-STATUS.md](MIGRATION-STATUS.md), and
the test commands are in [test/README.md](test/README.md). Java FOP is not required.

To make sure this component loads before yours, add a dependency in your component's component.xml file:

    <depends-on name="mr-marble"/>

```sh
./moq component-get mr-marble
./moq test mr-mantle mr-marble     # the regression suite, while working and before a commit
./moq accept mr-mantle mr-marble   # the acceptance suite (the screen sweeps), when asked
```

The suites and their specs are in [test/README.md](test/README.md).

Marble ERP covers both goods and services, since goods businesses also manage projects and tasks, and services
businesses also manage equipment and supplies. It is designed around business activities in 3 categories by the primary roles in the system: Internal, Supplier, and
Customer. These activities fit into high level business processes such as Procure to Pay (Supplier interactions) and
Order to Cash (Customer interactions), and are combined to support a complete end to end flow.

## License and Contributing

[CC0 1.0 Universal with a Grant of Patent License](LICENSE.md). To contribute code, sign
[AUTHORS.md](AUTHORS.md) in a commit from the account that submits the pull request; its Contributing
section has the details.
