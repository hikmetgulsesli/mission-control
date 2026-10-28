# Design action contrast

The native desktop audit of loaded Mission Control bb14788d found that the
explicit **Retrieve design** button is nearly unreadable. The existing class was
originally used by links; it refers to an undefined `--accent` token and leaves
the native button background in place. This defect directly affects the approved
passive-view change, which moved provider work behind that explicit action.

Use the existing `--neon-cyan`, `--bg-card` and `--bg-primary` tokens in the loaded
`src/index.css` rule for `.af-design-card__btn`. Give buttons and links sharing
that class a dark background and cyan text/border, an enabled hover state with
dark text on cyan, and a disabled state with a not-allowed cursor. Retain the
existing global focus-visible outline. Do not define a global `--accent` alias:
that would affect unrelated legacy styling. Do not edit the unused duplicate
stylesheet in `src/styles/components.css`.

Keep the label, GET/POST split, pending deduplication, cancellation and provider
behavior unchanged. Do not retrieve a design, start a run, edit runtime data,
restart a service or replace the running release for this source correction.

Acceptance is a successful stock build, independent review, and an unmodified
native screenshot of a private static preview using the exact production CSS.
The preview contains the real class on a button and link, plus a disabled button;
it has no script, backend, provider or business operation. Its result is a style
check, not evidence of a live release or complete application qualification.

This is a small reversible root fix within the user's approved UI improvement
scope and Standing Owner Authorization v1. Historical product-artifact errors,
legacy planning labels, annual provider readiness and Full8 are separate work.
