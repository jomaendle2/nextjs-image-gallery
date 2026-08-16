# The design system

Two registers, and almost every mistake on this site has come from applying
one register's rules in the other's territory.

**The viewer** is the gallery: `/`, `/by/[slug]`, `/photo/[id]`. The
photograph is the subject and everything else is chrome. Chrome is glass over
the image, white or near-white, and it never introduces a colour of its own —
the only colour in the viewer comes from the photograph. Controls hold their
size when their state changes, because a bar that resizes under a photograph
moves the photograph.

**The reading pages** are the documents: `/contribute/*`, `/membership`,
`/subscribe`, `/photographers`, and the three legal pages. These are read
rather than looked through. They sit on `--color-surface`, a step lighter
than the viewer's ground, and they are allowed one accent.

---

## Colour

Everything is a token in `src/app/globals.css`. No component invents a
colour; if you need one that is not here, add it here first.

### The two grounds

| Token | Value | Where |
| --- | --- | --- |
| `--ground` | `#0b0e12` | Under every photograph. Also the browser and PWA chrome. |
| `--color-surface` | `#12161a` | The reading pages. |

`--ground` is repeated in three places the language cannot connect: the
stylesheet, the layout's `themeColor`, and the manifest's `theme_color` and
`background_color`. They drifted once — the manifest carried the teal while
claiming in a comment to match — so `src/app/manifest.test.ts` now asserts
all four are the same colour. A comment asserting an invariant is a wish.

### The accent

| Token | Use |
| --- | --- |
| `--color-accent` | Text, icons, hairlines on dark. |
| `--color-accent-bright` | The hover step. |
| `--color-accent-fill` | Fills behind text. Low alpha; text must stay readable. |
| `--color-accent-fill-hover` | The hover step for fills. |
| `--color-accent-edge` | Borders and focus rings. |
| `--color-accent-ink` | Dark text on a solid accent fill. Rare. |

The hue is not a brand decision, it is a measurement: the published
photographs cluster in a sea-teal band (`#2a6b7c`, `#2184ab`, `#136aa0`,
`#4c89a1`) because this is a gallery of coastlines and sky. OKLCH, so the
lightness steps are perceptually even. Chroma stays modest — a saturated
teal beside a photograph competes with it, and the photograph wins.

**Where the accent is allowed:** the one primary action per view, links on
reading pages, focus rings, and the selected state. That is the whole list.

**Where it is not:** anywhere in the viewer, and on anything that is not the
thing you came to do. The membership page failed this on its first pass — it
coloured the "what you get" icons and the "be aware" icons alike, which turns
the accent into a bullet point and tells the reader a caveat is a feature.
`Row` takes a `tone` for exactly that reason.

### Message colour

`src/components/ui/Notice.tsx` owns error, warning and success. Errors carry
`role="alert"`; every tone carries an `sr-only` label, because colour alone
is not a message.

---

## Components

Reach for these before writing classes. Each exists because the same string
had been typed three or four times and had already drifted.

| Component / token | Owns |
| --- | --- |
| `GlassButton` | Every button. `variant="primary"` is the accent; at most one per view. |
| `TextLink` | Every link on a reading page. Internal and external, and the standalone-vs-inline touch rule. |
| `Notice` | Every error, warning and success message. |
| `FIELD`, `LABEL`, `LABEL_HINT` | Form fields. |
| `TOUCH_LINK` | The 44px floor for a standalone link, when `TextLink` does not fit. |
| `ContributeShell` | The frame for every reading page: title, breadcrumb, footer. |
| `SiteFooter` | The credit and the three legal links. |

### The 44px floor

Every interactive control clears 44px in both directions. The trick used
throughout is padding plus a matching negative margin, so the target grows
without moving the text beside it. This has been got wrong twice: once by
giving a link `min-h-11` and leaving it 13px wide, and once by reserving
`min-h-5` for a control that rests at 24.3px because an inline-flex child
sits on a text baseline.

---

## Motion

`--ease-glass` (`cubic-bezier(0.32, 0.72, 0, 1)`) everywhere. Deceleration
with no overshoot: photographs are not springy. Never animate layout
properties — transform and opacity only.

---

## What has actually gone wrong here

Kept because each was expensive to find and none of them is obvious.

- **A colour defined in two places drifts.** The manifest is the case with a
  test now; `--color-surface` exists because a near-black had been copied
  into three files and typed slightly differently in a fourth.
- **Reserving space is not the same as reserving the right space.** A
  four-pixel error in a held line is a visible jump on every swipe.
- **A component that is re-rendered rather than remounted does not reset.**
  The share button showed a ✓ over the wrong photograph for exactly this
  reason. Use a `key`; do not reset from an effect.
- **Colour that does not mean anything is noise.** If two things are
  different colours, a reader will look for the difference.
