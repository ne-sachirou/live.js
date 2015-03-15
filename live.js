/**
 * @description
 *   live.js
 *   Like `$().delegate()` of jQuery and Zepto.
 *   Not like jQuery and Zepto, we only implements one simple feature, and fully annotated.
 *   We only support latest versions of web browsers on desktop and mobile.
 * @author ne_Sachirou <utakata.c4se@gmail.com>
 * @license MIT License
 */
(function (scope) {
/**
 * @constructor
 * @type {function(string,HTMLElement=):live}
 */
scope.live = live;

/**
 * Events we support.
 *
 * @const
 * @type {Array.<string>}
 */
var targetEventNames = [
    'pointerdown',
    'pointerup',
    'pointermove',
    'pointerover',
    'pointerout',
    'pointercancel',
    'pointerenter',
    'pointerleave',
    'keydown',
    'keyup',
    'keypress',

    'mousemove',
    'mouseover',
    'mouseout',
    'mousedown',
    'mouseup',
    'click',
    'dblclick'
  ];

// {{{ pointerXY
/** @type {number} */
var pPointerX = 0;
/** @type {number} */
var pPointerY = 0;
/** @type {number} */
var pointerX = 0;
/** @type {number} */
var pointerY = 0;
document.body.addEventListener('pointermove', updatePointerXY);
document.body.addEventListener('pointerover', updatePointerXY);
document.body.addEventListener('pointerout', function(evt) {
  pointerX = pPointerX;
  pointerY = pPointerY;
});
/**
 * @param {MouseEvent} evt
 */
function updatePointerXY(evt) {
  pPointerX = pointerX;
  pPointerY = pointerY;
  pointerX = evt.clientX + window.scrollX;
  pointerY = evt.clientY + window.scrollY;
}
// }}} pointerXY

// {{{ live
/**
 * @constructor
 * @param {string} selector
 * @param {(HTMLElement|string)=} context =document.body
 * @return {live|FutureLive} Returns an equal instance when params are equal.
 */
function live(selector, context) {
  /** @type {live} */
  var instance;

  if (! (this instanceof live))
    return new live(selector, context);
  if (typeof context === 'string')
    return new FutureLive(selector, context);
  context = context || document.body;
  if (! context.bindings)
    initContext(context);
  instance = takeFirst(context.bindings,
    function(binding) { return binding.selector === selector; });
  if (instance)
    return instance;
  /** @type {string} */
  this.selector = selector;
  /** @type {HTMLElement} */
  this.context = context;
  /** @type {EventMap} */
  this.events = new EventMap;
  /** @type {Object.<string,EventMap> */
  this.namespaces = {};
  context.bindings.push(this);
}

/**
 * @param {string} selector as a future context.
 * @param {HTMLElement=} context =document
 * @param {function(HTMLElement)} callback
 */
live.onload = function(selector, context, callback) {
  var observer;

  /**
   * @param {MutationRecord} record
   */
  function onMutation(record) {
    toArray(record.addedNodes).forEach(
      function(node) {
        if (! node.tagName)
          return;
        fireOnMutation(node);
      });
  }

  /**
   * @param {HTMLElement} node
   */
  function fireOnMutation(node) {
    context.onLoadBindings.forEach(
      /** @param {LiveOnLoad} */
      function(binding) {
        var containsNode = contains(binding.selector, node, context);
        if (containsNode === node)
          binding.callback(node);
      });
  }

  if (typeof context === 'function') {
    callback = context;
    context = document;
  }
  if (! context.onLoadBindings) {
    /** @type {Array.<LiveOnLoad>} */
    context.onLoadBindings = [];
    observer = new MutationObserver(
      function(records) { records.forEach(onMutation); });
    observer.observe(context, { childList: true, subtree: true });
  }
  context.onLoadBindings.push(new LiveOnLoad(selector, callback));
};

live.prototype = {
  /**
   * @param {string} eventName Separated with space.
   * @param {function(Event):boolean} callback
   * @param {string=} namespace
   * @return {live}
   */
  on: function(eventName, callback, namespace) {
    var eventNames,
        me = this;

    eventName = eventName.trim().toLowerCase();
    eventNames = eventName.split(/\s+/);
    if (namespace) {
      if (! this.namespaces[namespace])
        this.namespaces[namespace] = new EventMap;
      eventNames.forEach(
        function(name) { me.namespaces[namespace][name].push(callback); });
    } else {
      eventNames.forEach(
        function(name) { me.events[name].push(callback); });
    }
    return this;
  },

  /**
   * @param {string=} eventName Separated with space.
   * @param {string=} namespace
   * @return {live}
   */
  off: function(eventName, namespace) {
    var eventNames,
        me = this;

    if (! eventName && ! namespace) {
      this.events = new EventMap;
      this.namespaces = {};
      return this;
    }
    eventName = eventName.trim().toLowerCase();
    eventNames = eventName.split(/\s+/);
    if (eventNames.length === 1 && isSupportedEvent(eventNames[0])) {
      if (namespace !== void 0) {
        eventNames.forEach(
          function(name) { me.namespaces[namespace][name] = []; });
      } else {
        this.events[eventName] = [];
        Object.keys(this.namespaces).forEach(
          function(namespace) {
            eventNames.forEach(
              function(name) { me.namespaces[namespace][name] = []; });
          });
      }
      return this;
    }
    namespace = eventName;
    this.namespaces[namespace] = new EventMap;
    return this;
  }
};

/**
 * @param {HTMLElement} context
 */
function initContext(context) {
  /** @type {Array.<live>} */
  context.bindings = [];
  targetEventNames.forEach(
    function(eventName) {
      context.addEventListener(eventName,
        function(evt) { fire(eventName, evt, context); },
        false);
    });
}

/**
 * @param {string} eventName
 * @param {Event} evt
 * @param {HTMLElement} context
 */
function fire(eventName, evt, context) {
  /**
   * @param {live} binding
   */
  function check(binding) {
    var containNode;

    containNode = contains(binding.selector, evt.target, context);
    if (! containNode)
      return;
    eventName = checkHover(containNode, eventName);
    if (! eventName)
      return;
    callEventCallback(binding.events, eventName, evt, binding);
    Object.keys(binding.namespaces).forEach(
      function(namespace) {
        callEventCallback(binding.namespaces[namespace], eventName, evt, binding);
      });
  }

  context.bindings.forEach(check);
}

/**
 * @param {HTMLElement} containNode
 * @param {string} eventName
 * @return {string}
 */
function checkHover(containNode, eventName) {
  var match, isContainPrev, isContain;
  var _px = pPointerX, _py = pPointerY, _x = pointerX, _y = pointerY;

  match = eventName.match(/^(pointer|mouse)(?:move|over|out)/i);
  if (! match)
    return eventName;
  isContainPrev = isContainPointer(containNode, _px, _py);
  isContain = isContainPointer(containNode, _x, _y);
  if (isContainPrev && isContain)
    return match[1] + 'move';
  else if (! isContainPrev && isContain)
    return match[1] + 'over';
  else if (isContainPrev && ! isContain)
    return match[1] + 'out';
  else
    return null;
}

/**
 * @param {EventMap} eventMap
 * @param {string} eventName
 * @param {Event} evt
 * @param {live} me
 */
function callEventCallback(eventMap, eventName, evt, me) {
  eventMap[eventName].forEach(
    function(callback) {
      var doseStop;

      doseStop = callback.call(me, evt);
      if (doseStop === false) {
        evt.preventDefault();
        evt.stopPropagation();
      }
    });
}
// }}} live

// {{{ FutureLive
/**
 * @constructor
 * @param {string} selector
 * @param {string} context selector
 */
function FutureLive(selector, context) {
  var me = this;

  live.onload(context,
    function(node) { bindFutureLive(node, me); });
  /** @type {string} */
  this.selector = selector;
  /** @type {EventMap} */
  this.events = new EventMap;
  /** @type {Object.<string,EventMap> */
  this.namespaces = {};
}

FutureLive.prototype = {
  on: function(eventName, callback, namespace) {
    live.prototype.on.call(this, eventName, callback, namespace);
    return this;
  },

  off: function(eventName, namespace) {
    live.prototype.off.call(this, eventName, callback, namespace);
    return this;
  }
};

/**
 * @param {HTMLElement} context
 * @param {FutureLive} futureLive
 */
function bindFutureLive(context, futureLive) {
  var binding = new live(futureLive.selector, context);

  binding.events.join(futureLive.events);
  Object.keys(futureLive.namespaces).forEach(
    function(namespace) {
      binding[namespace].join(futureLive[namespace]);
    });
}
// }}} FutureLive

// {{{ EventMap
/**
 * @constructor
 * @struct
 */
function EventMap() {
  var me = this;

  targetEventNames.forEach(
    function(eventName) { me[eventName] = []; });
}

EventMap.prototype = {
  /**
   * @param {EventMap} events
   * @return {EventMap}
   */
  join: function(events) {
    var me = this;

    Object.keys(this).forEach(
      function(eventName) {
        me[eventName] = me[eventName].concat(events[eventName]);
      });
    return this;
  }
};
// }}} EventMap

/**
 * @constructor
 * @struct
 */
function LiveOnLoad(selector, callback) {
  this.selector = selector;
  this.callback = callback;
}

// {{{ util
/**
 * @pure
 * @param {string} eventName
 * @return {boolean}
 */
function isSupportedEvent(eventName) {
  return targetEventNames.some(function(elm) { return elm === eventName; });
}

/**
 * Find a node selector-matched in which contains the node.
 *
 * @pure
 * @param {string} selector
 * @param {HTMLElement} node
 * @param {HTMLElement=} context =document
 * @return {HTMLElement?} Returns null when no one is found.
 */
function contains(selector, node, context) {
  context = context || document;
  return takeFirst(toArray(context.querySelectorAll(selector)),
    function(selectedNode) { return selectedNode === node; });
  // return takeFirst(toArray(context.querySelectorAll(selector)),
  //   function(selectedNode) { return selectedNode.contains(node); });
}

/**
 * @pure
 * @param {HTMLElement} node
 * @param {number} x
 * @param {number} y
 * @return {boolean}
 */
function isContainPointer(node, x, y) {
  var rect, left, top;

  rect = node.getBoundingClientRect();
  left = rect.left + window.scrollX;
  top = rect.top + window.scrollY;
  return left <= x && x < left + rect.width &&
    top <= y && y < top + rect.height;
}

// /** @type {boolean} */
// var isDOMContentLoaded = false;
// /** @type {Array.<function()>} */
// var domContentLoadedCallbacks = [];
// /**
//  * @param {function()} callback
//  */
// function ready(callback) {
//   if (isDOMContentLoaded)
//     callback();
//   else
//     domContentLoadedCallbacks.push(callback);
// }
// window.addEventListener('DOMContentLoaded',
//   function(evt) {
//     isDOMContentLoaded = true;
//     domContentLoadedCallbacks.forEach(
//       function(callback) { callback(); });
//     domContentLoadedCallbacks = [];
//   });

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

/**
 * @pure
 * @param {Array.<Object>} arr
 * @param {function(Object):boolean} fun
 * @return {Object?}
 */
function takeFirst(arr, fun) {
  var i, iz;

  for (i = 0, iz = arr.length; i < iz; ++i) {
    if (arr[i] !== void 0 && fun(arr[i]))
      return arr[i];
  }
  return null;
}
// }}} util

}(this));
