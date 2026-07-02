# AI Chat Scroll Engineering Skill

Use this skill when building or reviewing streaming AI/chat-like surfaces in this project, especially:

- Interview AI answers that stream token by token.
- Transcript feeds where new speech recognition lines arrive while the user is reading older content.
- Review summaries, long markdown answers, or any view that grows while the user may scroll.

## Product Context

The interview page behaves like an AI chat, but with two different scroll directions:

- AI answer panel: one selected question grows downward as the answer streams.
- Transcript panel: newest speech lines are shown at the top, so new content is prepended.

Do not treat these as ordinary `overflow: auto` boxes. Streaming content changes height often, markdown can reflow after rendering, and users frequently scroll away from the live edge to read or copy prior text.

## Principles

1. Never force auto-scroll by default.
   Only follow new content while the user is already at the live edge. Any wheel, touch, keyboard, selection, or manual scroll away from the edge must freeze the viewport.

2. New turns start near the top.
   When the selected interview question changes, reset the answer viewport to the top of that question. This gives the incoming answer room to grow downward while keeping the question visible.

3. Let off-screen content load quietly.
   If the user is not at the live edge, streaming text can continue outside the viewport. Show a small jump button instead of hijacking scroll.

4. Preserve the reader's line during layout shifts.
   When content is prepended above the current viewport, compensate `scrollTop` by the `scrollHeight` delta so the visible text does not jump.

5. Provide message-level navigation.
   Add stable `data-message-id` values to rows that may need navigation. Use `scrollToMessage(id)` rather than querying visual text.

## Local Implementation

This project uses `src/hooks/useSmartScroller.ts` instead of `@shadcn/react/message-scroller` for now, because the app is React 18 and MUI-based. The current `@shadcn/react` package targets React 19, so do not force it into the stable production branch until the app intentionally upgrades React.

The repo is now shadcn-ready:

- `components.json` defines the shadcn aliases and Tailwind config.
- `src/lib/utils.ts` provides `cn()`.
- `src/components/ui/*` contains local copy-owned UI primitives.
- `src/styles/globals.css` exposes shadcn-compatible CSS variables.

Use it for downward-growing streams:

```tsx
const answerScroller = useSmartScroller<HTMLDivElement>({
  edge: 'end',
  contentKey: `${message.id}:${message.content.length}`,
  resetKey: message.id,
  resetPosition: 'start',
});
```

Use it for newest-first feeds:

```tsx
const feedScroller = useSmartScroller<HTMLDivElement>({
  edge: 'start',
  contentKey: `${items[items.length - 1]?.id ?? 'empty'}:${items.length}`,
});
```

Wire the container:

```tsx
<Box ref={answerScroller.ref} onScroll={answerScroller.handleScroll} sx={{ overflowY: 'auto' }}>
  <Box data-message-id={`message-${message.id}`}>{children}</Box>
</Box>
```

Show a jump button only when `showJumpButton` is true:

```tsx
{answerScroller.showJumpButton && (
  <Button onClick={() => answerScroller.jumpToLiveEdge()}>最新</Button>
)}
```

## Review Checklist

- Does new streaming content follow only when the user is at the live edge?
- Does scrolling away immediately stop auto-follow?
- Does a new question reset the answer panel to the top of the new turn?
- Does prepended content keep the user's visible line anchored?
- Are rows assigned stable message ids?
- Is there a one-click way to jump back to latest?
- Does markdown/code/image reflow avoid stealing the user's place?

## References

- shadcn/ui Message Scroller: `MessageScroller` handles anchored turns, streamed replies, saved transcript restore, prepended history, jump-to-message, scroll controls, and visibility tracking.
- `@shadcn/react/message-scroller` is headless; it owns behavior while allowing the app to bring its own markup and styling.
