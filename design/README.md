# NeuroFlow design export

46 screenshots (1440x900 unless noted), numbered in the order they were delivered. The mockups say "FlowCards": the product name is **NeuroFlow**.

| Area | Files |
|---|---|
| Design system, tokens, type, components | 08, 09 (light), 10 (dark) |
| Sidebar | 21 |
| Board | 11 light, 12 dark, 13 RTL, 14 empty |
| Card detail (side panel, `[[` picker) | 15 light, 16 dark, 17 RTL |
| Today | 01 empty, 02 all done, 18 over capacity light, 19 dark, 20 RTL |
| Blitz (full screen) | 03 running light, 04 dark, 05 RTL, 06 overtime, 07 Pomodoro break, 22 finish dialog light, 23 dark, 24 writing-only |
| Floating timer (PiP 300x130, micro 160x60, paused, in-page fallback) | 25 light, 26 dark |
| Board x Blitz | 45 lane + dock light, 46 dark, 41 RTL; Plan layout 42 light, 43 dark, 44 RTL |
| Mind map | 27 light, 28 dark, 29 empty |
| Reports | 30 light, 31 dark, 32 empty |
| Command palette | 33 search light, 34 dark, 35 recent, 36 create |
| Settings | 37 light, 38 dark |
| Auth | 39 sign-in with error, 40 sign-up loading (dark) |

## Token values read from 08-design-system

Light: background `#FBF7F0`, surface `#FFFFFF`, surface 2 `#F5EFE4`, border `#E6DCCB`, text `#1D2733`, text 2 `#4A5562`, muted `#66717E`, teal `#0F766E`, teal hover `#0B5F58`, teal soft `#D6F1EC`, sun `#F5B800`, sun soft `#FFF0BD`, success `#15803D` / soft `#DAF3E2`, warning `#B45309` / soft `#FFEBCB`, overtime `#C93A30` / soft `#FFE1DD`.
Tags: violet `#7C5CFF`, pink `#F0508B`, orange `#FF8A3D`, lime `#6DBE2F`, sky `#2D9CF0`, mint `#14B8A6`, grape `#B04DE0`, gold `#E6A800`.

Dark: background `#12171C`, surface `#1A2128`, surface 2 `#232C36`, border `#33404C`, text `#F3EFE7`, text 2 `#B7C0CA`, muted `#98A3AF`, teal `#2DD4BF`, teal edge `#14A292`, teal soft `#123F3A`, sun `#FFC933`, sun soft `#46380C`, success `#4ADE80` / soft `#173D26`, warning `#FBBF24` / soft `#46330C`, overtime `#FF8A80` / soft `#4B1F1C`.
Tags: violet `#8F74FF`, pink `#FF6AA0`, orange `#FF9A55`, lime `#7DD13F`, sky `#4DB0FF`, mint `#2DD4BF`, grape `#C26BF0`, gold `#FFC933`.

Type (Inter + Noto Sans Arabic): timer 56/800 tabular, heading 28/800, title 20/700, body 16/400, UI 14/600, caption 12/500.
Radius: 8 input, 12 button, 16 card, pill chips. Spacing: 4px grid. Primary buttons have a 3px darker bottom edge ("raised"). Motion: short, springy on check-offs and card drops; nothing animates while a timer runs except progress.
