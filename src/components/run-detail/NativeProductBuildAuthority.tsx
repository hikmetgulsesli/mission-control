import type { ReactNode } from "react";
import type { ProductBuildPacketAuthorityV3 } from "../../lib/product-build-authority";

const MAX_VISIBLE_ITEMS = 200;

function Reference({ value }: { value: string | null | undefined }) {
  return <code title={value ?? undefined}>{value ?? "none"}</code>;
}

/** Nested collections in expanded source details obey the same display bound. */
function boundedDetail(value: unknown): unknown {
  if (Array.isArray(value)) {
    const visible = value.slice(0, MAX_VISIBLE_ITEMS).map(boundedDetail);
    return value.length > MAX_VISIBLE_ITEMS
      ? [...visible, { omittedFromRendering: value.length - MAX_VISIBLE_ITEMS }]
      : visible;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, boundedDetail(entry)]));
  }
  return value;
}

function SourceDetails({ value }: { value: unknown }) {
  return <details><summary>Full source references and fields</summary><pre>{JSON.stringify(boundedDetail(value), null, 2)}</pre></details>;
}

function Collection<T>({ label, items, children }: { label: string; items: readonly T[]; children: (item: T) => ReactNode }) {
  const visible = items.slice(0, MAX_VISIBLE_ITEMS);
  return (
    <details className="oe-section" open={items.length > 0 && items.length <= 4}>
      <summary><span>{label}</span><b>{items.length}</b></summary>
      <div className="oe-section__body">
        {visible.length === 0 ? <div className="oe-empty">None recorded.</div> : visible.map((item, index) => (
          <div className="oe-row" key={index}><div className="oe-row__summary">{children(item)}<SourceDetails value={item} /></div></div>
        ))}
        {items.length > visible.length && <div className="oe-empty">{items.length - visible.length} additional {label.toLowerCase()} omitted from rendering.</div>}
      </div>
    </details>
  );
}

export function NativeProductBuildAuthority({ authority, outerAuthorityHash, outerSchema }: {
  authority: ProductBuildPacketAuthorityV3;
  outerAuthorityHash: string;
  outerSchema: "setfarm.product-build-authority.v3";
}) {
  const graph = authority.designGraph;
  const sourceMap = authority.implementationSourceMap;
  return (
    <section className="oe-panel oe-panel--ok" aria-label="Canonical Product Build authority">
      <div className="oe-header">
        <div><span>PRODUCT</span><h3>Product Build Authority</h3></div>
        <strong>{outerSchema} · SEALED</strong>
      </div>
      <div className="oe-body">
        <div className="oe-metrics">
          <div><span>Packet</span><strong>v{authority.packet.packetVersion}</strong></div>
          <div><span>Stories</span><strong>{authority.storyPlan.stories.length}</strong></div>
          <div><span>Design source</span><strong>{authority.designSourceClosure.kind}</strong></div>
          <div><span>Implementation screens</span><strong>{sourceMap.screens.length}</strong></div>
        </div>
        <div className="oe-contract-grid">
          <div><span>Packet hash</span><Reference value={authority.packetHash} /></div>
          <div><span>Authority hash</span><Reference value={outerAuthorityHash} /></div>
          <div><span>Packet authority</span><Reference value={authority.authorityHash} /></div>
          <div><span>Compiler</span><Reference value={authority.packet.compiler.version} /><Reference value={authority.packet.compiler.codeSha} /></div>
          <div><span>Producer</span><Reference value={authority.producer.pass} /><Reference value={authority.producer.codeSha} /></div>
          {Object.entries(authority.refs).sort(([a], [b]) => a.localeCompare(b)).map(([name, hash]) => (
            <div key={name}><span>{name}</span><Reference value={hash} /></div>
          ))}
        </div>
        <div className="oe-sections">
          {graph === null ? (
            <div className="oe-empty">No design graph is required by this sealed packet. {authority.designSourceClosure.kind === "none" ? authority.designSourceClosure.reason : "Design source: stitch."}</div>
          ) : <>
            <Collection label="Native physical controls" items={graph.controls}>{control => <>
              <b><Reference value={control.id} /> · <Reference value={control.identity.actionRef} /></b>
              <span>controlSlotRef: <Reference value={control.identity.controlSlotRef} /> · surfaceRef: <Reference value={control.identity.surfaceRef} /></span>
              <span>elementRef: <Reference value={control.elementRef} /> · elementHash: <Reference value={control.elementHash} /></span>
              <span>targetRef: <Reference value={control.source.targetRef} /> · sourceHash: <Reference value={control.source.sourceHash} /></span>
              <span>role: {control.role ?? "none"} · href: {control.href ?? "none"} · nativeControlKind: {control.nativeControlKind ?? "none"}</span>
            </>}</Collection>
            <Collection label="Native action bindings" items={graph.actions}>{action => <>
              <b><Reference value={action.actionRef} /></b>
              <span>trigger: {action.triggerKind} · productActionHash: <Reference value={action.productActionHash} /></span>
            </>}</Collection>
            <Collection label="Native observable bindings" items={graph.observables}>{observable => <>
              <b><Reference value={observable.observableRef} /> · <Reference value={observable.actionRef} /></b>
              <span>evidenceRef: <Reference value={observable.evidenceRef} /> · assertionsHash: <Reference value={observable.assertionsHash} /></span>
              <span>targetRef: <Reference value={observable.source.targetRef} /> · sourceHash: <Reference value={observable.source.sourceHash} /></span>
              <span>roleReceipt: <Reference value={observable.roleReceipt?.receiptHash} /></span>
            </>}</Collection>
            <Collection label="Native surface bindings" items={graph.surfaces}>{surface => <>
              <b><Reference value={surface.surfaceRef} /></b><span>elementRef: <Reference value={surface.elementRef} /> · targetRef: <Reference value={surface.source.targetRef} /></span>
            </>}</Collection>
            <Collection label="Native target source authorities" items={graph.sourceAuthorities}>{source => <>
              <b><Reference value={source.targetRef} /> · <Reference value={source.responseScreenId} /></b><Reference value={source.sourceHash} />
            </>}</Collection>
          </>}
          <details className="oe-section" open>
            <summary><span>Native implementation source map</span><b>{sourceMap.screens.length}</b></summary>
            <div className="oe-section__body">
              <span>{sourceMap.schema} · design source: {sourceMap.designSourceKind}</span>
              <div>designGraphV2PayloadHash: <Reference value={sourceMap.designGraphV2PayloadHash} /></div>
              <div>screenIndexV2PayloadHash: <Reference value={sourceMap.screenIndexV2PayloadHash} /></div>
              <div>screenIndexSourceHash: <Reference value={sourceMap.screenIndexSourceHash} /></div>
              {sourceMap.designSourceKind === "none" ? <div className="oe-empty">No implementation screens are required by this design-source-none packet. Converter: none.</div> : <>
                <div>Converter: <Reference value={sourceMap.converter.converterId} /> · <Reference value={sourceMap.converter.sourceHash} /></div>
                <Collection label="Native implementation screens" items={sourceMap.screens}>{screen => <>
                  <b><Reference value={screen.targetRef} /> · <Reference value={screen.responseScreenId} /></b>
                  <span>pathRef: <Reference value={screen.pathRef} /> · path: <Reference value={screen.path} /></span>
                  <span>contentHash: <Reference value={screen.contentHash} /> · root surface: <Reference value={screen.rootSurface.surfaceRef} /> · elementRef: <Reference value={screen.rootSurface.sourceElementRef} /></span>
                </>}</Collection>
              </>}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
