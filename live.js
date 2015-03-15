/**
 * @description
 *   live.js
 *   Like `$().delegate()` of jQuery and Zepto.
 *   Not like jQuery and Zepto, we only implements one simple feature.
 *   We only support latest versions of web browsers on desktop and mobile.
 * @author ne_Sachirou <utakata.c4se@gmail.com>
 * @license MIT License
 */
(function (scope) {
/** @type {function(string,HTMLElement?):live} */
scope.live = live;

/** Events we support. */
var EVENT_NAMES = [
    'pointerover',
    'pointerenter',
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'pointerout',
    'pointerleave',
    'gotpointercapture',
    'lostpointercapture',

    'mousemove',
    'mouseover',
    'mouseout',
    'mousedown',
    'mouseup',

    'click',
    'dblclick',

    'keydown',
    'keyup',
    'keypress'
  ];

// {{{ util
function isSupportedEvent(eventName) {
  return EVENT_NAMES.some(function (elm) {
    return elm === eventName;
  });
}

/**
 * Find a node selector-matched in which contains the node.
 *
 * @param {string}       selector
 * @param {HTMLElement}  node
 * @param {HTMLElement?} context  =document
 *
 * @return {HTMLElement?} Returns null when no one is found.
 */
function contains(selector, node, context) {
  context = context || document;
  return takeFirst(Array.from(context.querySelectorAll(selector)), function (selectedNode) {
    return selectedNode === node;
  });
  // return takeFirst(Array.from(context.querySelectorAll(selector)), function (selectedNode) {
  //   return selectedNode.contains(node);
  // });
}

/**
 * @param {HTMLElement} node
 * @param {number}      x
 * @param {number}      y
 *
 * @return {boolean}
 */
function doseContainPointer(node, x, y) {
  var rect, left, top;
  rect = node.getBoundingClientRect();
  left = rect.left + window.scrollX;
  top = rect.top + window.scrollY;
  return (left <= x && x < left + rect.width) && (top <= y && y < top + rect.height);
}

if (!Array.from) {
  Array.from = function (obj) {
    return [].slice.call(obj);
  };
}

/**
 * @param {any<T>[]}                 arr
 * @param {function(any<T>):boolean} fun
 *
 * @return {any<T>?}
 */
function takeFirst(arr, fun) {
  var elm,
      i  = 0,
      iz = arr.length;
  for (; i < iz; ++i) {
    elm = arr[i];
    if (void 0 !== elm && fun(elm)) {
      return elm;
    }
  }
  return null;
}
// }}} util

// {{{ pointerXY
var pPointerX = 0,
    pPointerY = 0,
    pointerX  = 0,
    pointerY  = 0;
document.body.addEventListener('pointermove', updatePointerXY);
document.body.addEventListener('pointerover', updatePointerXY);
document.body.addEventListener('pointerout', function (evt) {
  pointerX = pPointerX;
  pointerY = pPointerY;
});

/** @param {PointerEvent} evt */
function updatePointerXY(evt) {
  pPointerX = pointerX;
  pPointerY = pointerY;
  pointerX  = evt.clientX + window.scrollX;
  pointerY  = evt.clientY + window.scrollY;
}
// }}} pointerXY

// {{{ live
/**
 * @constructor
 *
 * @prop {string}                   selector
 * @prop {HTMLElement}              context
 * @prop {EventMap}                 events
 * @prop {Object.<string,EventMap>} namespaces
 *
 * @param {string}                selector
 * @param {(HTMLElement|string)?} context  =document.body
 *
 * @return {live|FutureLive} Returns an equal instance when params are equal.
 */
function live(selector, context) {
  /** @type {live} */
  var instance;
  if ('string' === typeof context || context instanceof String) {
    return new FutureLive(selector, context);
  }
  if (!(this instanceof live)) {
    return new live(selector, context);
  }
  context = context || document.body;
  if (!context.bindings) {
    initContext(context);
  }
  instance = takeFirst(context.bindings, function (binding) {
    return binding.selector === selector;
  });
  if (instance) {
    return instance;
  }
  this.selector   = selector;
  this.context    = context;
  this.events     = new EventMap();
  this.namespaces = {};
  context.bindings.push(this);
}

/**
 * @param {string}       selector as a future context.
 * @param {HTMLElement?} context  =document
 *
 * @param {function(HTMLElement)} callback
 */
live.onload = function(selector, context, callback) {
  var observer;
  /** @param {MutationRecord} record */
  function onMutation(record) {
    Array.from(record.addedNodes).forEach(function (node) {
      if (! node.tagName)
        return;
      fireOnMutation(node);
    });
  }

  /** @param {HTMLElement} node */
  function fireOnMutation(node) {
    context.onLoadBindings.forEach(
      /** @param {LiveOnLoad} */
      function (binding) {
        if (contains(binding.selector, node, context) === node) {
          binding.callback(node);
        }
      });
  }

  if ('function' === typeof context) {
    callback = context;
    context = document;
  }
  if (!context.onLoadBindings) {
    /** @type {LiveOnLoad[]} */
    context.onLoadBindings = [];
    observer = new MutationObserver(function (records) {
      records.forEach(onMutation);
    });
    observer.observe(context, { childList: true, subtree: true });
  }
  context.onLoadBindings.push(new LiveOnLoad(selector, callback));
};

/**
 * @param {string}                  eventName Separated with space.
 * @param {function(Event):boolean} callback
 * @param {string?}                 namespace
 *
 * @return {live}
 */
live.prototype.on = function (eventName, callback, namespace) {
  var eventNames;
  eventName = eventName.trim().toLowerCase();
  eventNames = eventName.split(/\s+/);
  if (namespace) {
    if (!this.namespaces[namespace])
      this.namespaces[namespace] = new EventMap();
    eventNames.forEach(function(name) {
      this.namespaces[namespace][name].push(callback);
    }, this);
  } else {
    eventNames.forEach(function(name) {
      this.events[name].push(callback);
    }, this);
  }
  return this;
};

/**
 * @param {string?} eventName Separated with space.
 * @param {string?} namespace
 *
 * @return {live}
 */
live.prototype.off = function (eventName, namespace) {
  var eventNames;
  if (!eventName && !namespace) {
    this.events = new EventMap();
    this.namespaces = {};
    return this;
  }
  eventName = eventName.trim().toLowerCase();
  eventNames = eventName.split(/\s+/);
  if (eventNames.length === 1 && isSupportedEvent(eventNames[0])) {
    if (namespace !== void 0) {
      eventNames.forEach(function (name) {
        this.namespaces[namespace][name] = [];
      }, this);
    } else {
      this.events[eventName] = [];
      Object.keys(this.namespaces).forEach(function (namespace) {
        eventNames.forEach(function (name) {
          this.namespaces[namespace][name] = [];
        }, this);
      }, this);
    }
    return this;
  }
  namespace = eventName;
  this.namespaces[namespace] = new EventMap();
  return this;
};


/**
 * @param {HTMLElement} context
 */
function initContext(context) {
  /** @type {Array.<live>} */
  context.bindings = [];
  EVENT_NAMES.forEach(function (eventName) {
    context.addEventListener(eventName, function (evt) {
      fire(eventName, evt, context);
    }, false);
  });
}

/**
 * @param {string}      eventName
 * @param {Event}       evt
 * @param {HTMLElement} context
 */
function fire(eventName, evt, context) {
  /** @param {live} binding */
  function check(binding) {
    var containNode = contains(binding.selector, evt.target, context);
    if (!containNode) {
      return;
    }
    eventName = checkHover(containNode, eventName);
    if (!eventName) {
      return;
    }
    callEventCallback(binding.events, eventName, evt, binding);
    Object.keys(binding.namespaces).forEach(function (namespace) {
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
  var match, isContainPrev, isContain,
      _px = pPointerX,
      _py = pPointerY,
      _x  = pointerX,
      _y  = pointerY;
  match = eventName.match(/^(pointer|mouse)(?:move|over|out)/i);
  if (!match) {
    return eventName;
  }
  isContainPrev = doseContainPointer(containNode, _px, _py);
  isContain = doseContainPointer(containNode, _x, _y);
  if (isContainPrev && isContain) {
    return match[1] + 'move';
  } else if (!isContainPrev && isContain) {
    return match[1] + 'over';
  } else if (isContainPrev && !isContain) {
    return match[1] + 'out';
  } else {
    return null;
  }
}

/**
 * @param {EventMap} eventMap
 * @param {string}   eventName
 * @param {Event}    evt
 * @param {live}     me
 */
function callEventCallback(eventMap, eventName, evt, me) {
  eventMap[eventName].forEach(function (callback) {
    var doseStop = callback.call(me, evt);
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
 *
 * @prop {string}                   selector
 * @prop {EventMap}                 events
 * @prop {Object.<string,EventMap>} namespaces
 *
 * @param {string} selector
 * @param {string} context  selector
 */
function FutureLive(selector, context) {
  var me = this;
  live.onload(context, function (node) {
    bindFutureLive(node, me);
  });
  this.selector   = selector;
  this.events     = new EventMap();
  this.namespaces = {};
}

FutureLive.prototype.on = function (eventName, callback, namespace) {
  live.prototype.on.call(this, eventName, callback, namespace);
  return this;
};

FutureLive.prototype.off = function (eventName, namespace) {
  live.prototype.off.call(this, eventName, callback, namespace);
  return this;
};

/**
 * @param {HTMLElement} context
 * @param {FutureLive}  futureLive
 */
function bindFutureLive(context, futureLive) {
  var binding = new live(futureLive.selector, context);
  binding.events.join(futureLive.events);
  Object.keys(futureLive.namespaces).forEach(function (namespace) {
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
  EVENT_NAMES.forEach(function (eventName) {
    this[eventName] = [];
  }, this);
}

/**
 * @param {EventMap} events
 *
 * @return {EventMap}
 */
EventMap.prototype.join = function (events) {
  Object.keys(this).forEach(function (eventName) {
    this[eventName] = this[eventName].concat(events[eventName]);
  }, this);
  return this;
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

}(this));
// vim:fdm=marker:
