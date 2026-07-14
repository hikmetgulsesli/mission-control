import assert from "node:assert/strict";
import test from "node:test";

import { validateCommand } from "./terminal.js";

test("terminal allows only explicit read-only Setfarm command forms", () => {
  assert.equal(validateCommand("setfarm", ["version"]), null);
  assert.equal(validateCommand("setfarm", ["logs"]), null);
  assert.equal(validateCommand("setfarm", ["logs", "#1996"]), null);
  assert.equal(validateCommand("setfarm", ["workflow", "runs"]), null);
});

test("terminal cannot bypass canonical run action or claim authority", () => {
  const mutatingForms = [
    ["workflow", "stop", "run-1", "--force"],
    ["workflow", "resume", "run-1"],
    ["workflow", "run", "feature-dev", "task"],
    ["workflow", "retry", "run-1"],
    ["step", "peek", "developer"],
    ["step", "complete", "step-1"],
    ["step", "fail", "step-1"],
    ["medic"],
  ];
  for (const args of mutatingForms) {
    assert.match(validateCommand("setfarm", args) || "", /Only read-only Setfarm forms/);
  }
});

test("terminal rejects Setfarm log flags and path-shaped arguments", () => {
  assert.match(validateCommand("setfarm", ["logs", "--follow"]) || "", /Only read-only/);
  assert.match(validateCommand("setfarm", ["logs", "../../secret"]) || "", /Only read-only/);
  assert.match(validateCommand("setfarm", []) || "", /Only read-only/);
});
