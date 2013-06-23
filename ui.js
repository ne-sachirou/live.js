/// {{{ collectSnippets
(function(scope) {
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

  toArray(document.getElementsByTagName('code')).forEach(
    function(code) { code.innerHTML = code.innerHTML.trim(); });
  sections = collectSnippets();
  snippets = toArray(document.querySelectorAll('pre.snippet'));
  snippets.forEach(init);
}

/**
 * Convert Array-like object to Array.
 *
 * @pure
 * @param {object} obj
 * @return {Array}
 */
function toArray(obj) {
  var i, iz,
      acum = [];

  for (i = 0, iz = obj.length; i < iz; ++i)
    acum.push(obj[i]);
  return acum;
}
