'use strict';

function documentedDispatches(markdown) {
  return [...markdown.matchAll(/`gh workflow run\s+(\S+)([^`]*)`/g)].map((match) => ({
    workflow: match[1],
    inputs: [...match[2].matchAll(/(?:^|\s)-(?:f|F)\s+([A-Za-z_][A-Za-z0-9_-]*)=/g)]
      .map((input) => input[1]),
  }));
}

function workflowDispatchInputContract(workflow) {
  const lines = workflow.split(/\r?\n/);
  const dispatchIndex = lines.findIndex((line) => /^\s{2}workflow_dispatch:\s*$/.test(line));
  if (dispatchIndex === -1) {
    return null;
  }

  const inputs = [];
  let inInputs = false;
  let currentInput = null;
  for (const line of lines.slice(dispatchIndex + 1)) {
    if (/^\S/.test(line)) break;
    if (/^\s{4}inputs:\s*$/.test(line)) {
      inInputs = true;
      continue;
    }
    if (inInputs && /^\s{4}\S/.test(line)) break;
    const input = inInputs && line.match(/^\s{6}([A-Za-z_][A-Za-z0-9_-]*):\s*$/);
    if (input) {
      currentInput = {name: input[1], required: false};
      inputs.push(currentInput);
      continue;
    }
    if (currentInput && /^\s{8}required:\s*true\s*$/.test(line)) {
      currentInput.required = true;
    }
  }
  return inputs;
}

function workflowDispatchInputs(workflow) {
  return workflowDispatchInputContract(workflow)?.map((input) => input.name) ?? null;
}

function unsupportedDispatchInputs(markdown, workflows) {
  const errors = [];
  for (const dispatch of documentedDispatches(markdown)) {
    const workflow = workflows[dispatch.workflow];
    if (workflow === undefined) {
      errors.push(`${dispatch.workflow}: documented workflow is missing`);
      continue;
    }
    const contract = workflowDispatchInputContract(workflow);
    if (contract === null) {
      errors.push(`${dispatch.workflow}: workflow_dispatch is missing`);
      continue;
    }
    const accepted = contract.map((input) => input.name);
    for (const input of dispatch.inputs) {
      if (!accepted.includes(input)) {
        errors.push(`${dispatch.workflow}: unsupported documented input ${input}`);
      }
    }
    for (const input of contract.filter((entry) => entry.required)) {
      if (!dispatch.inputs.includes(input.name)) {
        errors.push(`${dispatch.workflow}: required input ${input.name} is undocumented`);
      }
    }
  }
  return errors;
}

module.exports = {
  documentedDispatches,
  unsupportedDispatchInputs,
  workflowDispatchInputContract,
  workflowDispatchInputs,
};
