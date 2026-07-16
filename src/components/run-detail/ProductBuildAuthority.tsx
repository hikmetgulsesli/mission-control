import {
  productBuildAuthorityReason,
  type ProductBuildAuthorityState,
  type ProductDesignBindingV1,
} from "../../lib/product-build-authority";

const MAX_VISIBLE_BINDINGS = 200;

function shortHash(value: string | undefined): string {
  return value && value.length > 16 ? `${value.slice(0, 12)}…` : value || "-";
}

function actionRefs(binding: ProductDesignBindingV1): string[] {
  if (binding.disposition === "action" && binding.actionRef) return [binding.actionRef];
  if (binding.disposition === "value_input") return [...new Set((binding.fields || []).map((field) => field.actionRef))];
  return [];
}

export function ProductBuildAuthority({ state }: { state: ProductBuildAuthorityState }) {
  if (state.status !== "ok") {
    return (
      <section className={`oe-panel oe-panel--${state.status}`} aria-label="Canonical Product Build authority">
        <div className="oe-header">
          <div><span>PRODUCT</span><h3>Product Build Authority</h3></div>
          <strong>{state.status.replace("_", " ").toUpperCase()}</strong>
        </div>
        <div className="oe-unavailable">
          <b>Sealed product authority is unavailable.</b>
          <p>{productBuildAuthorityReason(state)}</p>
          <p>No agent output, story prose, or GitHub comment is used as a fallback.</p>
        </div>
      </section>
    );
  }

  const authority = state.authority;
  const controls = authority.designGraph.controls;
  const controlsById = new Map(controls.map((control) => [control.id, control]));
  const designBindings = authority.designGraph.bindings;
  const stitchBindings = authority.designSources?.responseBindings.bindings || [];
  const renderedCandidates = authority.designSources?.renderedSemantics.candidates.length || 0;
  const targets = authority.designSources?.generationTargets.targets.length || 0;
  const visibleDesignBindings = designBindings.slice(0, MAX_VISIBLE_BINDINGS);
  const visibleStitchBindings = stitchBindings.slice(0, MAX_VISIBLE_BINDINGS);

  return (
    <section className="oe-panel oe-panel--ok" aria-label="Canonical Product Build authority">
      <div className="oe-header">
        <div><span>PRODUCT</span><h3>Product Build Authority</h3></div>
        <strong>{authority.schema}</strong>
      </div>
      <div className="oe-body">
        <div className="oe-metrics">
          <div><span>Packet</span><strong>v{authority.packet.packetVersion}</strong></div>
          <div><span>Stories</span><strong>{authority.storyPlan.stories.length}</strong></div>
          <div><span>Controls / bindings</span><strong>{controls.length} / {designBindings.length}</strong></div>
          <div><span>Targets / rendered</span><strong>{targets} / {renderedCandidates}</strong></div>
        </div>

        <div className="oe-contract-grid">
          <div><span>Packet hash</span><code title={authority.packetHash}>{shortHash(authority.packetHash)}</code></div>
          <div><span>Authority hash</span><code title={authority.authorityHash}>{shortHash(authority.authorityHash)}</code></div>
          <div><span>Compiler</span><code>{authority.packet.compiler.version} · {shortHash(authority.packet.compiler.codeSha)}</code></div>
          <div><span>Producer</span><code>{authority.producer.pass} · {shortHash(authority.producer.codeSha)}</code></div>
          {Object.entries(authority.refs).sort(([left], [right]) => left.localeCompare(right)).map(([name, hash]) => (
            <div key={name}><span>{name}</span><code title={hash}>{shortHash(hash)}</code></div>
          ))}
        </div>

        <div className="oe-sections">
          <details className="oe-section" open={visibleStitchBindings.length > 0 && visibleStitchBindings.length <= 4}>
            <summary><span>Exact Stitch target bindings</span><b>{stitchBindings.length}</b></summary>
            <div className="oe-section__body">
              {visibleStitchBindings.length === 0 ? (
                <div className="oe-empty">
                  {authority.packet.packetVersion === 1
                    ? "Legacy packet v1 has no versioned design-source closure."
                    : "No Stitch target bindings are required by this sealed packet."}
                </div>
              ) : visibleStitchBindings.map((binding) => (
                <div className="oe-row" key={binding.targetRef}>
                  <div className="oe-row__summary">
                    <b>{binding.targetRef} → {binding.responseScreenId}</b>
                    <span>{binding.requestScreenKey} · {binding.expectedScreenTitle} · stage {binding.stageId}</span>
                    <span>DOM {shortHash(binding.semanticDomHash)} · observation {shortHash(binding.semanticObservationHash)}</span>
                    <span>elements {binding.contractElementRefs.join(", ")}</span>
                  </div>
                  <code title={`${binding.htmlArtifactHash} / ${binding.screenshotArtifactHash}`}>
                    HTML {shortHash(binding.htmlArtifactHash)} · PNG {shortHash(binding.screenshotArtifactHash)}
                  </code>
                </div>
              ))}
              {stitchBindings.length > visibleStitchBindings.length && (
                <div className="oe-empty">{stitchBindings.length - visibleStitchBindings.length} additional binding(s) omitted from rendering.</div>
              )}
            </div>
          </details>

          <details className="oe-section" open={visibleDesignBindings.length > 0 && visibleDesignBindings.length <= 4}>
            <summary><span>Exact control/action/link dispositions</span><b>{designBindings.length}</b></summary>
            <div className="oe-section__body">
              {visibleDesignBindings.map((binding) => {
                const control = controlsById.get(binding.controlRef);
                const refs = actionRefs(binding);
                return (
                  <div className="oe-row" key={binding.controlRef}>
                    <div className="oe-row__summary">
                      <b>{binding.controlRef} · {binding.disposition}{refs.length ? ` · ${refs.join(", ")}` : ""}</b>
                      <span>{control?.surfaceRef || "missing surface"} · {control?.kind || "missing control"} · {control?.source.locator || "missing source"}</span>
                      <span>
                        states {(binding.stateRefs || []).join(", ") || "none"}
                        {" · "}persistence {(binding.persistenceRefs || []).join(", ") || "none"}
                        {" · "}evidence {(binding.evidenceRefs || []).join(", ") || "none"}
                      </span>
                    </div>
                    <code title={control?.renderedSource?.artifactHash || control?.source.artifactHash}>
                      {control?.renderedSource
                        ? `${control.renderedSource.elementRef} · ${control.renderedSource.locator}`
                        : control?.source.selector || "source unavailable"}
                    </code>
                  </div>
                );
              })}
              {designBindings.length > visibleDesignBindings.length && (
                <div className="oe-empty">{designBindings.length - visibleDesignBindings.length} additional disposition(s) omitted from rendering.</div>
              )}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
