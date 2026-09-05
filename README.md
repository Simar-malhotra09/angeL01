# This is a word processor which is _just_ that.

To start:

```
git clone https://github.com/Simar-malhotra09/angeL01.git
cd angeL01
bun install
bun run dev
```

That is it.

- Supports vim motions natively with @replit/codemirror-vim.
- `Cmd + Shift + P` to see shortcuts.
- :w initiates explicit write to sqlite db.
- :wq/:q writes and goes back to homepage.
- Export as HTML with most of the functionality included.
- Typst in posts (rendered to SVG on HTML export, needs `typst` installed):
  - `$ ... $` for math inline in a sentence
  - `$$ ... $$` for a centred math block
  - ` ```typst ` blocks for full Typst excerpts

Example: This blog: [Who needs a runtime?](https://simar-malhotra09.github.io/writing/documents/who-needs-a-runtime.html) was written using angel.

Update log:

[2026/Sep/5]: Fix typst errors in preview, Fix slider width overflow

- Typst errors are now readable. When a snippet fails to compile, the badge flips from `preview` to a solid `error` one, so you can tell something broke without hovering. Hovering shows the error in plain form: the message, which line and column of _your_ snippet it points at (it used to point at a hidden wrapper file, which was useless), the line itself with a `^^^^` mark under the bad part, and typst's hints for fixing it. The tooltip also stamps the time the api call was made at the bottom, so you can tell whether the svg or error you're looking at still matches the code you have. On export, failed snippets come out in the html in the same plain format.

- Width slider no longer lets the text run under the sidebars. Before, dragging it to max (1200) pushed the writing column over the toc on the left and the highlight cards on the right, so text and sidebar sat on top of each other. Now the slider's top end caps itself to whatever fits between the two sidebars on your screen, and re-checks when you resize the window. On narrower windows where the sidebars are hidden, the full 480–1200 range is still there.

[2026/Sep/2]: Typst svgs now size themselves to the text around them. Before, the math inside an svg was always drawn small (11pt) and sat in a wide empty frame, so it looked tiny next to your writing. Now the glyphs come out at exactly the size of the body text, both in the editor preview and on export, and the empty frame is much thinner. If you want bigger or smaller math on purpose, use a ```typst block with the code on its own lines and say `#set text(size: 14pt)` inside it — sizes end up relative: 14pt comes out 14/11 times the normal text size. Writing the fence and the code on a single line does nothing, the fence only works with line breaks.

[2026/Sep/1]: Enclosing text, Sticky highlight cards, Typst blocks, width slider (not stable).

- You can now enclose text within chars: Select text (cursor or visual mode), Cmd + Opt + S, enter two chars, first goes to start of selected line, second goes to end.

- Sticky/Floating(default) highlight cards: By default, they are embeeded on the same location idx within the document as the highlighted line; making them sticky will push all of them to the top, while preserving the order. (Put simply, say you have 2 highlights in a multi 'page' document, one at start and one at end. In floating mode, you will only see the highlight card for the first highlight, assuming you are at the start of the document, since that first highlighted line is in 'view'. As you scroll to the end, the first highlight card goes out of view, while the second one appears as the second highlighed text comes into view. If you switch to sticky mode, both highlight cards appear, irrespective of where you are in the document.)

- Typst blocks: You can now write typst code, using `$...$` for inline math block, `$$...$$` for centered math block, and ```typst for arbitrary code. On pressing `:w`, we send a req to `/api/typst-svg`, which spawns a process to compile the code with the typst compile (ie the binary must be installed in you system), exports it as svg, and you see a `preview` tooltip in the editor, right after the eclosing '$/$$'. Hovering on it shows the svg, so you can easily modify the code and see how it compiles live. Note that currently we don't have support for errors (which happen really freq); we intent to add that soon. When you export you document as html, all the svgs get inline embedded. See bugs/todo section for known issues.

- Width slider: You can now increase or decrease the width of the text-writeable area with the slider. It has some known issues where the text collides with the sidebar and we will fix that next.

[2026/Aug/30]: Basic Typst support: inline math, centred math blocks, and full Typst excerpts compile to SVG on HTML export (uses your installed `typst`, cached so re-exports are fast).

[2026/Aug/27]: Added tabs in command palette. Group similar commands and essentially paginate them on main tab by that group + orphan commands.

[2026/Aug/22]: Added lance chrome extension. Super useful if you are using a lot of links; please see `lance/README.md`!

[2026/Aug/17]: Support japenese. You must see [pr #7 comments](https://github.com/Simar-malhotra09/angeL01/pull/7) first to be able to use it!

[2026/Aug/16]: The wp is functionable as shown by the above link. Further major changes will be stated here.

TODO:

- Bugs:
  - [x] On max slider width, the canavs text collides with the sidebar text so we need to clamp it. Maybe decrease the padding for the sidebars?
  - [x] Highlights keeps capturing the selected text if the text has nothing in front of it. [textA][textB][highlight textA] works fine, but [textA][highlight textA][textB] captures [textB] as well.
  - [x] Styling with `*/**`: currently we can't style word with italics if it's a part of a bold sentence, ie, ** this is a _italicized_ word doesn't work**.

- [x] Add support for typst errors in preview tooltip.
- [ ] Being able to force-index lines/text content in the Toc sidebar: Currently only #/##/### header sections get an entry there.
- [ ] UI oh god the UI; where is your taste?
- [ ] Being able to write romaji underneath japanese text.
- [x] Can we add, at the minimum, basic typst functionality? (done: rendered to SVG on HTML export)
- [x] Add indents with Tab
- [x] Be able to dynamically change the width of the 'text writeable canvas' through a bottom floating sleek horizonatal scrollbar? Max/Min?
- [x] For highlights, add a label for notes as well, where the card doesn't contain the selected text but user notes about it.
- [x] For highlights, add a stickly vs floating (the current/def behaviour). Sticky will show as many card as can be fit in the current view.
- [x] Enclosing text with custom char: Basically, select text in visual mode + hotkey + left side char + right side char. Eg: text -> (text)
