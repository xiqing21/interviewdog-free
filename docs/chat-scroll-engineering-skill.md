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

This project uses `@shadcn/react/message-scroller` for streaming chat behavior. The app has been upgraded to React 19 so the headless primitive can be used directly.

The repo is now shadcn-ready:

- `components.json` defines the shadcn aliases and Tailwind config.
- `src/lib/utils.ts` provides `cn()`.
- `src/components/ui/*` contains local copy-owned UI primitives.
- `src/styles/globals.css` exposes shadcn-compatible CSS variables.

Use it for downward-growing streams:

```tsx
<MessageScroller.Provider autoScroll defaultScrollPosition="start">
  <MessageScroller.Root>
    <MessageScroller.Viewport>
      <MessageScroller.Content>
        <MessageScroller.Item messageId={message.id} scrollAnchor>
          {children}
        </MessageScroller.Item>
      </MessageScroller.Content>
    </MessageScroller.Viewport>
    <MessageScroller.Button direction="end">最新</MessageScroller.Button>
  </MessageScroller.Root>
</MessageScroller.Provider>
```

Use it for newest-first feeds:

```tsx
<MessageScroller.Provider autoScroll defaultScrollPosition="start">
  <MessageScroller.Root>
    <MessageScroller.Viewport preserveScrollOnPrepend>
      <MessageScroller.Content>
        {items.map((item, index) => (
          <MessageScroller.Item key={item.id} messageId={item.id} scrollAnchor={index === 0}>
            {item.content}
          </MessageScroller.Item>
        ))}
      </MessageScroller.Content>
    </MessageScroller.Viewport>
    <MessageScroller.Button direction="start">最新</MessageScroller.Button>
  </MessageScroller.Root>
</MessageScroller.Provider>
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
