# Auvora local development storage layout (Windows QA machine)

| Component                        | Path                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Repository                       | `D:\auvora-wallet`                                                                |
| Android SDK                      | `D:\Android\Sdk`                                                                  |
| Gradle                           | `D:\AuvoraDevCache\gradle`                                                        |
| Pub cache                        | `D:\AuvoraDevCache\pub-cache`                                                     |
| npm cache                        | `D:\AuvoraDevCache\npm`                                                           |
| pnpm store                       | `D:\AuvoraDevCache\pnpm\store`                                                    |
| pnpm home                        | `D:\AuvoraDevCache\pnpm\home`                                                     |
| Docker WSL disk                  | `D:\DockerData\wsl\disk\docker_data.vhdx`                                         |
| Cursor snapshots                 | `D:\AuvoraDevCache\cursor-snapshots` (junction from `%APPDATA%\Cursor\snapshots`) |
| Cursor state (after move script) | `D:\AuvoraDevCache\cursor-state\live`                                             |
| QA archives                      | `D:\AuvoraArchive\old-builds`                                                     |
| Safety git bundles               | `D:\AuvoraArchive\safety`                                                         |

Configure caches: `powershell -File D:\auvora-wallet\scripts\qa\configure-dev-cache-d.ps1`

After closing Cursor completely (one-click recovery):
`powershell -File D:\auvora-wallet\scripts\qa\finish-storage-recovery.ps1`

Or step-by-step:
`powershell -File D:\auvora-wallet\scripts\qa\finish-cursor-state-move.ps1`

Restart QA stack:
`powershell -File D:\auvora-wallet\scripts\qa\restart-core-local-qa.ps1`
