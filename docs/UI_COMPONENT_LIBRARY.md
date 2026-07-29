# UI Component Library (`@auvora/ui`)

Inventory of exported primitives (Phase 27). Import from `@auvora/ui`. Styles: `@auvora/ui/styles.css`.

**Component count:** ~40+ named React exports covering actions, forms, feedback, overlays, navigation, data, layout, and theming.

## Actions

| Component    | Notes                                                                 |
| ------------ | --------------------------------------------------------------------- |
| `Button`     | `variant`: primary / secondary / ghost / danger; `size`: sm / md / lg |
| `IconButton` | Requires `label` (accessible name)                                    |
| `Icon`       | Lucide wrapper; `size`: sm / md / lg                                  |

## Forms

| Component                                                                              | Notes                      |
| -------------------------------------------------------------------------------------- | -------------------------- |
| `Input`, `Textarea`                                                                    | `invalid` → `aria-invalid` |
| `Label`, `Field`, `FormHint`, `FormError`                                              | Field composition          |
| `Checkbox`, `Radio`, `RadioGroup`, `Switch`                                            | Radix                      |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `SelectField` | Radix + convenience field  |

## Feedback

| Component                                                 | Notes                                         |
| --------------------------------------------------------- | --------------------------------------------- |
| `Alert`                                                   | tones: info / success / warn / error          |
| `Badge`, `StatusBadge`                                    | StatusBadge maps status string → CSS modifier |
| `ToastProvider`, `Toaster`, `useToast`                    | Auto-dismiss toasts                           |
| `Loader`, `Skeleton`, `LoadingBlock`                      | Loading affordances                           |
| `EmptyState`, `ErrorState`, `SuccessState`, `AsyncStates` | Async UX                                      |

## Overlays

| Component                                                                                                      | Notes                            |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `Dialog`, `DialogTrigger`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogActions`, `DialogClose` | Radix                            |
| `Drawer`, `DrawerContent`, …                                                                                   | Side panel via Dialog primitives |
| `Popover`, `PopoverTrigger`, `PopoverContent`, …                                                               | Radix                            |
| `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent`, `SimpleTooltip`                              | Radix                            |

## Navigation

| Component                                        | Notes                                          |
| ------------------------------------------------ | ---------------------------------------------- |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Radix                                          |
| `Breadcrumbs`                                    | Link list with current page                    |
| `Pagination`                                     | Page / pageCount / onPageChange                |
| App `Nav`                                        | Stays app-local (route lists); uses DS nav CSS |

## Data

| Component                                   | Notes                                     |
| ------------------------------------------- | ----------------------------------------- |
| `Card`, `CardHeader`                        | Surface container                         |
| `Table`, `THead`, `TBody`, `TR`, `TH`, `TD` | Accessible table                          |
| `List`, `ListItem`                          | Simple lists                              |
| `Avatar`                                    | Initials or image                         |
| `ChartFrame`                                | Metric / chart frame (no heavy chart lib) |
| `PageHeader`                                | Title / subtitle / actions                |

## Layout

| Component                                       | Notes                            |
| ----------------------------------------------- | -------------------------------- |
| `AppShell`                                      | Header + optional sidebar + main |
| `Sidebar`, `Container`, `Stack`, `Grid`, `Page` | Responsive shells                |

## Theme

| Component                                  | Notes                 |
| ------------------------------------------ | --------------------- |
| `ThemeProvider`, `useTheme`, `ThemeToggle` | light / dark / system |

## Utilities

`cn`, `tokens`, `colorLight`, `colorDark`, `cssVar`, `space`, `radius`, `font`, `typography`, `elevation`, `zIndex`, `motion`, `iconSize`, `THEME_STORAGE_KEY`.

## Gallery

`/design-system` on web (3000) and admin (3001) showcases the inventory for visual QA.
