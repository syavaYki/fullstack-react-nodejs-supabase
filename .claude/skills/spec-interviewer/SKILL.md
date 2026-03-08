---
name: spec-interviewer
description: Conduct in-depth interviews to gather requirements and write specs. Triggers when user says "interview me about..." or asks to be interviewed for a spec, requirements, plan, or design. Uses AskUserQuestionTool to ask non-obvious, insightful questions that surface edge cases, tradeoffs, and considerations the user might not have thought about. Adapts to any domain dynamically.
---

# Spec Interviewer

Conduct comprehensive interviews using `AskUserQuestionTool` to gather requirements, then write a structured spec to `SPEC.md`.

## Interview Process

### Opening

Jump straight into questions after a brief "I'll interview you about X." No initial brain-dump or open-ended preamble.

### Question Style

**Structured options preferred.** Format questions with clear A/B/C choices:

- "For the layout, should it be A) grid, B) list, or C) masonry?"
- "How should failures be handled? A) Silent retry, B) User notification, C) Fail fast with error"

**Bundled questions.** Group 2-3 related questions per `AskUserQuestionTool` call:

```
1. What data sources feed into this?
2. How fresh does the data need to be?
3. Who owns the data pipeline?
```

**Non-obvious questions.** Avoid surface-level questions. Probe second-order effects, edge cases, and tradeoffs:

- Bad: "What features do you want?"
- Good: "If a user has 50 unread notifications, should new ones still appear immediately or batch into a digest?"

### Handling Responses

**Partial answers.** If user answers only part of a bundled question, immediately follow up on unanswered parts before moving on.

**Uncertainty.** When user says "I don't know" or hasn't considered something, offer 2-3 concrete options with minimal tradeoffs:

- "Option A: Cache aggressively (faster, stale data risk). Option B: No caching (always fresh, slower). Option C: Short TTL (balanced)."

**Contradictions.** Call out contradictions immediately when detected:

- "Earlier you said speed was critical, but this approval flow adds significant latency—which wins?"

### Domain Adaptation

This skill handles any domain dynamically. When encountering unfamiliar territory:

- Admit uncertainty: "I'm not sure what the common approaches are here—what options are you considering?"
- Build mental model as interview progresses and probe gaps

### Tone

Stay neutral and clinical. Purely extract information—no conversational filler or perspective-sharing.

## Interview Flow

**Dynamic depth.** Go deep when user seems uncertain or topic is complex. Stay shallow when things are clear. No announced phases—keep it organic.

**No mid-interview summaries.** Keep moving. The final spec is where interpretation surfaces.

**Track coverage.** Build mental model of areas discussed. Note gaps (e.g., "mentioned integrations and UI but nothing about error handling").

## Completion Criteria

**Soft cap: 15-20 questions.** Start wrapping up unless major areas remain unexplored.

**Autonomous decision.** Decide when coverage is sufficient based on:

- Core functionality defined
- Key edge cases addressed
- No obvious gaps in mental model of the system

**Push back if needed.** If major gaps exist: "You haven't mentioned authentication at all—should I probe that before writing the spec?"

## Spec Output

### Pre-Write Announcement

Before writing, announce planned sections:
"Based on our conversation, I'll structure the spec with these sections: [list sections]"

### File Location

Use `AskUserQuestionTool` to ask where to save: "Where should I save the spec? (default: SPEC.md)"

### Format

Always Markdown (`.md`).

### Structure

Adapt structure to what was discussed. A CLI tool spec differs from a design system spec. Common sections:

- Overview
- Requirements / User Flows
- Technical Details (if discussed)
- Edge Cases & Error Handling
- Assumptions Made
- Open Questions (if any remain)

### Content

Capture everything discussed. Distill to what's needed for implementation. Include assumptions made when user chose from offered options.
