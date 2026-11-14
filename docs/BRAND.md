# Reclaimng brand guidelines (v1.0)

The live, interactive version of this guide is at **`/brand`** on the site. This file is the written reference for designers, developers and anyone writing for Reclaimng.

---

## 1. The idea

Reclaimng exists for one of the hardest weeks of a family's life. The brand has to hold two things at once: the weight of grief, and the relief of finally knowing what to do. We call that feeling **liberating calm**.

The visual language comes from **adire**, the indigo resist-dyed cloth of Abeokuta and Ibadan. Adire is made by hand, square by square, and each square has its own motif and meaning. It is:

- Nigerian, without being a cliché;
- crafted rather than generated: every line has a slight wobble;
- about bringing something hidden back to the surface. That is exactly what we do with money.

**Tagline:** *Find what they left behind, and bring it home.*

### Principles

| Principle | In practice |
| --- | --- |
| Human, not corporate | Hand-drawn lines, real words, warm paper. Nothing glossy, no stock gradients, no template look. |
| Clear, not clever | One idea per screen, plain language, big readable type. Older relatives are our core users. |
| Hopeful, not heavy | Saffron light against indigo. We acknowledge loss, then move people forward. |

---

## 2. Logo

The **mark** is a lowercase *r* whose arm reaches out and brings the **coin** home. It reads as a letter, as a person (the stem is family), or as a path that curves back. The same saffron coin dots the *i* in the **wordmark** (`reclaımng`), so the two always belong together.

| File | Use |
| --- | --- |
| `public/brand/lockup.svg` | Primary: mark + wordmark on cotton or paper |
| `public/brand/lockup-reversed.svg` | On indigo night |
| `public/brand/mark.svg` | Mark alone (favicons, avatars, small spaces) |
| `public/brand/mark-ink.svg` | One colour: fax, stamps, embossing |
| `public/brand/mark-reversed.svg` | Mark on an indigo night square |
| `public/brand/wordmark.svg`, `wordmark-reversed.svg` | Wordmark alone |
| `public/brand/app-icon.svg` | App icon and favicon (`app/icon.svg`) |

All text is outlined, so the files work without the font installed. Regenerate them with `scripts/brand/build-logo.js` (instructions at the top of that file). In the app, use `<Logo />`, `<LogoMark />` and `<Wordmark />` from `components/logo.tsx`.

**Rules**

- **Clear space:** at least the coin's diameter on every side.
- **Minimum size:** lockup 96px wide on screen (24mm in print); mark 20px.
- **Colour:** an indigo or ink stem on cotton; a cotton stem on indigo night. The coin is always saffron, except in one-colour printing, where everything is ink.
- **Don't** stretch, rotate, outline or add effects. Don't change or drop the coin, place the logo on photos or busy pattern, or rebuild the wordmark in another font.

---

## 3. Colour: the adire palette

| Name | Hex | Token | Role | Share |
| --- | --- | --- | --- | --- |
| Cotton | `#F7F1E6` | `cotton` / `background` | The page. Undyed cloth, never stark white. | ~58% |
| Paper | `#FFFCF6` | `paper` / `surface` | Cards and fields. | |
| Indigo | `#2A3586` | `indigo` / `primary` | Primary actions, links, the mark. | ~16% |
| Indigo night | `#1A2160` | `indigo-night` | Deep blocks: footer, safety, the quilt. | ~10% |
| Ink | `#151A3B` | `ink` | Text and selected states. | ~8% |
| Saffron | `#F2B035` | `saffron` / `accent` | The coin. Highlights, the one loud button, "you are here". **Never text on light.** | ~5% |
| Clay | `#B0432A` | `clay` | Eyebrows, warmth, things that need you. | ~2% |
| Leaf | `#1D6A48` | `leaf` / `success` | Success only: done, found, released. | ~1% |

The tokens are defined once in `app/globals.css` (HSL custom properties) and exposed to Tailwind in `tailwind.config.ts`. Opacity modifiers work on every token (`bg-ink/10`).

### Approved text pairs (WCAG 2.2 AA)

| Pair | Ratio | Use |
| --- | --- | --- |
| Ink on Cotton | 15.0 : 1 | Body text |
| Indigo on Cotton | 9.6 : 1 | Links, buttons |
| Muted (`#585C74`) on Cotton | 5.8 : 1 | Hints, metadata |
| Clay on Cotton | 5.1 : 1 | Eyebrows |
| Cotton on Indigo night | 13.1 : 1 | Deep blocks |
| Saffron on Indigo night | 7.7 : 1 | Highlights on dark |
| Ink on Saffron | 8.9 : 1 | Accent button, pricing block |
| Cotton on Clay | 5.1 : 1 | Closing blocks (don't lower its opacity) |
| Cotton on Leaf | 5.8 : 1 | Success fills |

Every page is scanned with axe-core (`npm run test:a11y`) at desktop and phone widths.

---

## 4. Typography

| Role | Family | Weights | Why |
| --- | --- | --- | --- |
| Display | **Bricolage Grotesque** | 700–800, tight tracking, optical size 96 | Expressive and slightly irregular, like hand-cut type. Gives headlines a voice. |
| Body & UI | **Atkinson Hyperlegible** | 400, 700 | Designed by the Braille Institute so similar characters (I l 1, O 0) never get confused. The slashed zero matters when someone types an 11-digit NIN, a BVN or an account number. |

Both are free on Google Fonts and loaded with `next/font` in `app/layout.tsx`.

| Style | Size | Use |
| --- | --- | --- |
| Display XL (`text-display-xl`) | 48 → 108px | Landing hero only |
| Display L (`text-display-lg`) | 40 → 72px | Section headlines, page heroes |
| Display M (`text-display-md`) | 32 → 48px | Page titles in the app |
| Heading | 24 → 32px | Card and step titles |
| Body L | 20px | Intros |
| Body | 17px (minimum) | Everything else |
| Eyebrow (`.eyebrow`) | 14px bold caps, clay | Labels above headings |

---

## 5. Pattern and hand

Eight motifs live in `components/brand/motifs.tsx`. Each is drawn with a seeded wobble, so no line is perfectly straight and every render is identical.

| Motif | Yoruba | Meaning | Where |
| --- | --- | --- | --- |
| `sun` | Oòrùn | A new day after loss | Identity, being seen |
| `waves` | Olókun | Money flowing back | Account search |
| `dots` | Ìbàdàn dún | Many accounts, counted | Accounts found |
| `leaves` | Ewé | Family, lineage, papers | Documents |
| `zigzag` | Àkàbà | One step at a time | Needs your attention |
| `spiral` | Ìgbín | Patience | In review, 404 |
| `stitch` | Ìràwọ̀ | Care, the maker's hand | Texture |
| `house` | Ilé | Home, where it all ends up | Completed |

- **The quilt** (`<AdireQuilt />`) is the signature image: a patchwork of motif squares on indigo. A saffron square in the quilt is always the coin.
- **Stage cloths:** each case stage has its own motif and dye (`components/brand/stage-art.ts`), used on case cards and the case header.
- **Hand-drawn accents:** `<Underline>` (saffron swash under the one phrase that matters) and `<Circled>` (clay ring around something small, simple or done). Use **at most one per screen**.
- Never put text directly on a motif, recolour motifs outside the palette, or animate patterns continuously.

---

## 6. Voice and tone

We sound like the most capable person in the family: the one who has done this before, speaks plainly, and doesn't rush you.

- **Plain over legal.** Explain first, then name the thing ("the papers the court gives you: Letters of Administration").
- **Honest about time and money.** Show the amount before payment and the real wait ("up to 30 days").
- **Gentle with grief.** "Your loved one", "passed away". Never "the deceased" on screen.
- **Always say what happens next**, and whose turn it is.

| We say | Instead of |
| --- | --- |
| Your loved one passed away | The deceased / decedent |
| We could not approve the documents yet | Submission rejected |
| There is nothing you need to do right now | Status: pending |
| Find every linked account | Initiate BVN asset discovery |
| Chat with us | Contact support |

---

## 7. Components

Built on Radix primitives in the shadcn/ui style (`components/ui/*`), themed entirely with the tokens above.

- **Buttons** are pills. `primary` (indigo) for most actions; `accent` (saffron with a printed ink edge) for **the one action that matters most on a screen**; `secondary` (outlined, inverts to ink on hover); `ghost`; `link`.
- **Touch targets** are 44px minimum and 48–56px for main actions. **Fields** are 56px tall, with a label above, a hint under the label, and errors announced in words.
- **Focus** is always visible: a 3px indigo ring.
- **Status badges:** warning = in review, info = your turn, success = found/complete, danger = needs your attention.
- **Motion** is gentle (fade-up, hand-drawn strokes drawing in once) and switched off under `prefers-reduced-motion`.

---

## 8. Inspiration and references

- **Adire cloth** (Abeokuta, Ibadan): the patchwork structure, indigo palette and motif vocabulary.
- **Mobbin:**
  - Pi and Jitter: one warm question per screen, cream paper and big type (wizard steps).
  - Expensify and Xero: bold colour blocks and marked words in headlines (landing).
  - Coinbase onboarding: clear step status and progress (case cards and timeline).
- **Dribbble / Behance:** African fintech identities that reject the category's cold blue-green defaults (e.g. Verve's Flutterwave system), and editorial "warm paper + expressive grotesque" layouts.
- **Pinterest boards:** warm editorial web design: cream canvases, hand-drawn accents, terracotta and indigo palettes.
