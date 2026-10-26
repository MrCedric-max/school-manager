# Class 1 book — illustration prompts and status

All pictures were AI-generated for this book, in one flat-vector style so the book looks
like one artist made it: thick clean outlines, flat colour fills, no gradients, rounded
shapes, no text or letters in the image (so nothing has to be translated).

Cameroon is the setting in every picture: school uniforms, the compound, the market, the
moto-taxi, ndolé/koki, the mosquito net, the flag's green–red–yellow.

| File | Used for | Notes |
|---|---|---|
| `cover-front.png / .jpg` | front cover | cropped from `cover.png` (bottom grass removed) |
| `cover.png` | certificate (small) | full 2:3 portrait version |
| `theme-home.png` | Theme 1 opener | compound, mother cooking, father sweeping, hens, papaya |
| `theme-village.png` | Theme 2 opener, Units 6 & 7 | market street, moto-taxi, goats, palm |
| `theme-school.png` | Theme 3 opener | classroom, teacher, pupils at desks |
| `theme-jobs.png` | spare (not used) | early jobs line-up; replaced by `unit-09-jobs-cameroon` |
| `theme-travel.png` | spare (not used) | bus/bridge scene; replaced by `unit-10-travel-cameroon` |
| `unit-01-hello.png` | Unit 1 | teacher greeting two pupils at the gate |
| `unit-02-family.png` | Unit 2 | family portrait under a tree |
| `unit-03-numbers.png` | Unit 3 | countable groups: 1 ball … 5 paw-paws |
| `unit-04-colours.png` | Unit 4 | child drawing a rainbow, coloured objects |
| `unit-05-home-interior.png` | Unit 5 | cutaway home: net, stove, plates, jerrycan, broom |
| `unit-08-animals.png` | Unit 8 | farmyard animals |
| `unit-09-jobs-cameroon.png` | Unit 9 | nurse, teacher, carpenter, market woman, moto rider |
| `unit-10-travel-cameroon.png` | Unit 10 | yellow taxi, city bus, moto helmets, canoe, bridge |
| `unit-11-food-cameroon.png` | Unit 11 | ndolé, koki, rice and beans, fruit, hand-washing |
| `unit-12-body.png` | Unit 12 | two pupils + head/hand/foot/ear/eye/nose icons |

Print assets are `print/*.jpg`: 1600 px on the long edge, quality 88, stripped of metadata
(≈236 dpi at the 17 cm print width).

## Prompts

Each was generated from a prompt of this shape (substitute the scene):

> Children's book illustration, flat vector style, warm palette, Cameroonian setting.
> **[scene]**. Soft rounded shapes, thick clean outlines, flat colour fills, no gradients.
> Wide horizontal composition. No text, no letters, no numbers.

Scene notes worth keeping if you regenerate:

- **Unit 3** must have countable, well-separated objects: 1 ball, 2 plantains, 3 mangoes,
  4 hens, 5 paw-paws.
- **Unit 9** — nurse, teacher, carpenter, market woman with head-tray, moto rider with helmet.
- **Unit 10** — yellow city taxi, green-and-white city bus, helmets, canoe, metal bridge.
- **Unit 11** — ndolé with plantains, koki in leaves, rice and beans, mango/paw-paw/guava,
  children washing fruit with soap.
- **Unit 12** — body-part icons must stay simple and separate from the children.

## Not used / to redo

- `theme-jobs.png` and `theme-travel.png`: superseded by the Cameroon-specific unit art.
  Safe to delete, or keep as spares.
- Nothing in the book shows a Cameroonian landscape outside the village/town setting; a
  designer may want a Mount Cameroon or a northern savannah scene for variety.

## Theme art added for the 8-theme scheme (Oct 2026)

| File | Used for | Notes |
|---|---|---|
| `print/theme-health.jpg` | Theme 6 opener, week 24 | tippy-tap handwashing, toothbrush, covered food, clean yard |
| `print/theme-games.jpg` | Theme 7 opener, weeks 25 & 28 | football, skipping rope, clap game, bottle-cap board game |
| `print/theme-communication.jpg` | Theme 8 opener, weeks 29 & 32 | mobile phone, radio, letter, talking drum, face-to-face talk |

Prompts for these three:

> Children's book illustration, flat vector style, Cameroonian setting. **[scene]**. Soft
> rounded shapes, thick clean outlines, flat colour fills, no gradients. Wide horizontal
> composition. No text, no letters, no numbers.

Scenes: (a) two children washing hands at a tippy-tap with soap and towel, a third
brushing teeth, covered plate and clean water nearby; (b) children on a swept schoolyard —
football, skipping rope, clap game, board game with bottle caps, mango tree behind;
(c) girl on a mobile phone, boy with a radio, mother writing a letter, father with a
talking drum, two children talking with blank speech bubbles.

## Removed with the 8-theme rewrite

`unit-03-numbers`, `unit-04-colours` and `unit-08-animals` no longer match any week of the
scheme (the scheme has no numbers/colours/animals theme for Class 1) and were deleted from
`print/`. Their prompts are still in git history if the school wants a numbers or colours
supplement.
