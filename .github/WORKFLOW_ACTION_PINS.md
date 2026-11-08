# GitHub Actions pin provenance

External actions in `.github/workflows/` are pinned to the commit resolved from
the version tag shown in the comment beside each use. Dependabot continues to
monitor the original `github-actions` references and proposes reviewed updates
to both the commit and comment.

| Action version | Pinned commit | Resolution source |
| --- | --- | --- |
| `actions/checkout@v7` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `refs/tags/v7` |
| `actions/github-script@v9` | `3a2844b7e9c422d3c10d287c895573f7108da1b3` | dereferenced `refs/tags/v9` |
| `actions/setup-node@v7` | `949feb2413d6458794dcd2491c4babbbce0c15c1` | `refs/tags/v7` |
| `actions/setup-dotnet@v6` | `0f4a354dd5547a28c70b7853dbd95d5b67886e73` | `refs/tags/v6` |
| `actions/upload-artifact@v7` | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | `refs/tags/v7` |
| `actions/download-artifact@v8` | `9000827ccba6bdab643e8b6fd33ac0654aef8333` | `refs/tags/v8` |
| `aws-actions/configure-aws-credentials@v6` | `e1253824e5c10ff9df46874f81ed3ec929e19cfd` | dereferenced `refs/tags/v6` |
| `hashicorp/setup-terraform@v4` | `dfe3c3f87815947d99a8997f908cb6525fc44e9e` | `refs/tags/v4` |
| `github/codeql-action@v4` | `33d7b85da1a04171e211befe2c739303b9a4c066` | dereferenced `refs/tags/v4` |

The table records the resolution performed for this issue on 2026-11-08. A
future Dependabot update must refresh the corresponding row and version comment
in the same reviewed change.
