import assert from "node:assert/strict";
import test from "node:test";
import corpus from "../../tests/fixtures/product-build-authority-v3-wire.json" with { type: "json" };
import { hashCanonicalJson } from "./setfarm-canonical-json-v1.js";
import { parseProductBuildAuthority, parseProductBuildAuthorityV1, parseProductBuildRefusalV2 } from "./setfarm-product-build-authority-core.js";
import { parseProductBuildAuthorityV3 } from "./product-build-authority-v3-parser.js";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as RecordValue;
}
function fixture(name: string): RecordValue {
  const entry = corpus.cases.find((item) => item.name === name);
  assert.ok(entry);
  return structuredClone(entry.wire);
}
function hashIdentity(value: RecordValue): void {
  const { authorityHash: _hash, ...identity } = value;
  value.authorityHash = hashCanonicalJson(identity);
}
const children = [
  ["productSpec", "productSpecV2Hash", "productSpecV2"],
  ["designGraph", "designGraphV2Hash", "designGraphV2"],
  ["buildTopology", "buildTopologyV1Hash", "buildTopologyV1"],
  ["storyPlan", "storyPlanV2Hash", "storyPlanV2"],
  ["designSourceClosure", "designSourceClosureV2Hash", "designSourceClosureV2"],
  ["implementationSourceMap", "implementationSourceMapV1Hash", "implementationSourceMapV1"],
] as const;
// Refresh every enclosing digest, not the inner semantic relationships under test.
function rehashNative(wire: RecordValue): void {
  const native = record(wire.packetAuthority);
  const refs = record(native.refs);
  const packet = record(native.packet);
  const report = record(native.compilationReport);
  const reportRefs = record(report.artifactHashes);
  const envelopeHash = (payload: unknown) => payload === null ? null : hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1", artifactType: record(payload).schema,
    producer: native.producer, payload,
  });
  for (const [field, packetField, reportField] of children) {
    refs[field] = envelopeHash(native[field]);
    packet[packetField] = refs[field];
    reportRefs[reportField] = refs[field];
  }
  native.packetHash = refs.packet = envelopeHash(packet);
  report.packetHash = native.packetHash;
  refs.compilationReport = envelopeHash(report);
  hashIdentity(native);
  hashIdentity(wire);
}
const legacy = { packet: parseProductBuildAuthorityV1, refusal: parseProductBuildRefusalV2 };

for (const entry of corpus.cases) {
  test(`native server parser preserves paired ${entry.name} wire exactly`, () => {
    assert.equal(parseProductBuildAuthorityV3(entry.wire, entry.wire.runId, legacy), entry.wire);
    assert.equal(parseProductBuildAuthority(entry.wire, entry.wire.runId), entry.wire);
  });
}

test("rehashed native control remains accepted before tampering", () => {
  const wire = fixture("native_stitch");
  rehashNative(wire);
  assert.equal(parseProductBuildAuthority(wire, String(wire.runId)), wire);
});

const tamperCases: Array<[string, string, (native: RecordValue) => void]> = [
  ["source-map version shared with browser predicate", "native_none", (native) => { record(native.implementationSourceMap).sourceMapVersion = 99; }],
  ["source-map payload hash", "native_none", (native) => { record(native.implementationSourceMap).productSpecV2PayloadHash = "0".repeat(64); }],
  ["source-map screen target hash", "native_stitch", (native) => { record((record(native.implementationSourceMap).screens as unknown[])[0]).targetHash = "0".repeat(64); }],
  ["source-map response binding hash", "native_stitch", (native) => { record((record(native.implementationSourceMap).screens as unknown[])[0]).responseBindingHash = "0".repeat(64); }],
  ["null graph agreement", "native_stitch", (native) => { native.designGraph = null; }],
  ["source label", "native_stitch", (native) => { record(record(native.designSources).renderedSemantics).schema = "setfarm.stitch-rendered-semantics.v99"; }],
  ["known nested graph schema with unknown control type", "native_stitch", (native) => { record((record(native.designGraph).controls as unknown[])[0]).nativeControlKind = "future_control"; }],
  ["known product schema with unknown action trigger", "native_none", (native) => { record(record((record(native.productSpec).actions as unknown[])[0]).trigger).kind = "future_trigger"; }],
  ["known response schema with unknown selector type", "native_stitch", (native) => { record((record((record(record(native.designSources).responseBindings).bindings as unknown[])[0]).observableBindings as unknown[])[0]).selectorKind = "future_selector"; }],
  ["invalid compiler", "native_none", (native) => { record(record(native.packet).compiler).codeSha = "invalid"; }],
  ["producer/compiler disagreement", "native_none", (native) => { record(native.producer).codeSha = "d".repeat(40); }],
  ["missing closure source", "native_stitch", (native) => { delete record(native.designSourceClosure).generationTargets; }],
  ["nested source payload drift", "native_stitch", (native) => { record(record(native.designSources).generationTargets).targets = []; }],
  ["native extra key", "native_none", (native) => { native.agentSummary = "unsupported authority"; }],
  ["refs extra key", "native_none", (native) => { record(native.refs).invented = "0".repeat(64); }],
  ["source-set extra key", "native_stitch", (native) => { record(native.designSources).invented = {}; }],
];
for (const [name, caseName, tamper] of tamperCases) {
  test(`rejects ${name} after enclosing native and outer hashes are refreshed`, () => {
    const wire = fixture(caseName);
    assert.equal(parseProductBuildAuthority(wire, String(wire.runId)), wire);
    tamper(record(wire.packetAuthority));
    rehashNative(wire);
    assert.throws(() => parseProductBuildAuthority(wire, String(wire.runId)));
  });
}

test("top-level semantic envelope ref is verified independently of wrapper hashes", () => {
  const wire = fixture("native_none");
  const native = record(wire.packetAuthority);
  record(native.refs).productSpec = "0".repeat(64);
  record(native.packet).productSpecV2Hash = "0".repeat(64);
  record(record(native.compilationReport).artifactHashes).productSpecV2 = "0".repeat(64);
  hashIdentity(native); hashIdentity(wire);
  assert.throws(() => parseProductBuildAuthority(wire, String(wire.runId)));
});

test("nested closure envelope refs may have a different producer from the top-level compiler", () => {
  const wire = fixture("native_stitch");
  const native = record(wire.packetAuthority);
  const sources = record(native.designSources);
  const closure = record(native.designSourceClosure);
  const parentProducerEnvelope = hashCanonicalJson({ schema: "setfarm.semantic-artifact-envelope.v1", artifactType: record(sources.generationTargets).schema, producer: native.producer, payload: sources.generationTargets });
  assert.notEqual(record(closure.generationTargets).envelopeHash, parentProducerEnvelope, "Paired source retains its independently produced envelope ref");
  assert.equal(parseProductBuildAuthority(wire, String(wire.runId)), wire);
});

test("native wrapper hash, run identity, packet schema and refusal exclusivity fail closed", () => {
  for (const mutate of [
    (wire: RecordValue) => { wire.authorityHash = "0".repeat(64); },
    (wire: RecordValue) => { record(wire.packetAuthority).runId = "foreign-run"; rehashNative(wire); },
    (wire: RecordValue) => { record(wire.packetAuthority).schema = "setfarm.product-build-packet-authority.v99"; rehashNative(wire); },
    (wire: RecordValue) => { wire.refusal = {}; hashIdentity(wire); },
    (wire: RecordValue) => { wire.agentSummary = "extra"; hashIdentity(wire); },
  ]) {
    const wire = fixture("native_none"); mutate(wire);
    assert.throws(() => parseProductBuildAuthority(wire, String(wire.runId)));
  }
  const refused = fixture("refused_before_packet");
  refused.packetAuthority = fixture("native_none").packetAuthority;
  hashIdentity(refused);
  assert.throws(() => parseProductBuildAuthority(refused, String(refused.runId)));
  const native = fixture("native_none");
  assert.throws(() => parseProductBuildAuthority(native, "foreign-run"));
});
