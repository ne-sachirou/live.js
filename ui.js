if (!Array.from) {
  Array.from = function (obj) { return [].slice.call(obj); };
}

/// {{{ collectSnippets
(function (scope) {
  scope.collectSnippets = collectSnippets;

  /** @type {string?} */
  var currentSection = null;
  /** @type {Object.<string,string> */
  var sections = {};

  /**
   * return {Object.<string,string>}
   */
  function collectSnippets() {
    var script;

    scctions = {};
    script = document.querySelector('script.snippet').textContent;
    script.split('\n').forEach(collectLines);
    return sections;
  }

  /**
   * @param {string} line
   */
  function collectLines(line) {
    var match;

    match = line.match(/^\/\/\s*{{{\s*(.+)$/);
    if (match) {
      currentSection = match[1];
      sections[match[1]] = '';
      return;
    }
    if (! currentSection)
      return;
    match = line.match(/^\/\/\s*}}}\s*(.+)$/);
    if (! match)
      sections[currentSection] += line + '\n';
    else
      currentSection = null;
  }
}(this));
// }}} collectSnippets

window.addEventListener('DOMContentLoaded', initSnippets);
/**
 * @param {Event} evt
 */
function initSnippets(evt) {
  var sections, snippets;

  /**
   * @use sections
   * @param {HTMLPreNode} snippet pre.snippet>code
   */
  function init(snippet) {
    var section = snippet.dataset.section,
        code = snippet.getElementsByTagName('code')[0];

    if (sections[section])
      code.textContent += sections[section];
  }

  Array.from(document.getElementsByTagName('code')).forEach(
    function (code) { code.innerHTML = code.innerHTML.trim(); });
  sections = collectSnippets();
  snippets = Array.from(document.querySelectorAll('pre.snippet'));
  snippets.forEach(init);
}
