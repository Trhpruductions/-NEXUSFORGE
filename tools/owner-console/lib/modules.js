"use strict";

// Loads a package from this console's folder first, then from the repo root (where pg and dotenv are installed).
// Nothing is installed by this console.

const { CONSOLE_ROOT, REPO_ROOT } = require("./config");

function loadModule(name) {
  return require(require.resolve(name, { paths: [CONSOLE_ROOT, REPO_ROOT] }));
}

module.exports = { loadModule };
