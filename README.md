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

Example: This blog: [Who needs a runtime?](https://simar-malhotra09.github.io/writing/documents/who-needs-a-runtime.html) was written using angel.

Update log:

[2026/Aug/22]: Added lance chrome extension. Super useful if you are using a lot of links; please see `lance/README.md`!

[2026/Aug/17]: Support japenese. You must see [pr #7 comments](https://github.com/Simar-malhotra09/angeL01/pull/7) first to be able to use it!

[2026/Aug/16]: The wp is functionable as shown by the above link. Further major changes will be stated here.

TODO:

- Bugs:
  - [-] Highlights keeps capturing the selected text if the text has nothing in front of it. [textA][textB][highlight textA] works fine, but [textA][highlight textA][textB] captures [textB] as well.
  - [-] Styling with `*/**`: currently we can't style word with italics if it's a part of a bold sentence, ie, ** this is a _italicized_ word doesn't work**.

- [ ] Add single line occupying bold text as toggle in navbar.
- [-] Add indents with <tab>
- [ ] Be able to dynamically change the width of the 'text writeable canvas' through a bottom floating sleek horizonatal scrollbar? Max/Min?
- [ ] For highlights, add a label for notes as well, where the card doesn't contain the selected text but user notes about it.
- [ ] For highlights, add a stickly vs floating (the current/def behaviour). Sticky will show as many card as can be fit in the current view.
- [ ] Enclosing text with custom char: Basically, select text in visual mode + hotkey + left side char + right side char. Eg: text -> (text)
- [ ] UI oh god the UI; where is your taste?
- [ ] Can we add, at the minimum, basic typst functionality?
- [ ] Use a port naming utility
