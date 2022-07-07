
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    /*!
     * Pusher JavaScript Library v7.0.3
     * https://pusher.com/
     *
     * Copyright 2020, Pusher
     * Released under the MIT licence.
     */

    var pusher = createCommonjsModule(function (module, exports) {
    (function webpackUniversalModuleDefinition(root, factory) {
    	module.exports = factory();
    })(window, function() {
    return /******/ (function(modules) { // webpackBootstrap
    /******/ 	// The module cache
    /******/ 	var installedModules = {};
    /******/
    /******/ 	// The require function
    /******/ 	function __webpack_require__(moduleId) {
    /******/
    /******/ 		// Check if module is in cache
    /******/ 		if(installedModules[moduleId]) {
    /******/ 			return installedModules[moduleId].exports;
    /******/ 		}
    /******/ 		// Create a new module (and put it into the cache)
    /******/ 		var module = installedModules[moduleId] = {
    /******/ 			i: moduleId,
    /******/ 			l: false,
    /******/ 			exports: {}
    /******/ 		};
    /******/
    /******/ 		// Execute the module function
    /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    /******/
    /******/ 		// Flag the module as loaded
    /******/ 		module.l = true;
    /******/
    /******/ 		// Return the exports of the module
    /******/ 		return module.exports;
    /******/ 	}
    /******/
    /******/
    /******/ 	// expose the modules object (__webpack_modules__)
    /******/ 	__webpack_require__.m = modules;
    /******/
    /******/ 	// expose the module cache
    /******/ 	__webpack_require__.c = installedModules;
    /******/
    /******/ 	// define getter function for harmony exports
    /******/ 	__webpack_require__.d = function(exports, name, getter) {
    /******/ 		if(!__webpack_require__.o(exports, name)) {
    /******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
    /******/ 		}
    /******/ 	};
    /******/
    /******/ 	// define __esModule on exports
    /******/ 	__webpack_require__.r = function(exports) {
    /******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
    /******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    /******/ 		}
    /******/ 		Object.defineProperty(exports, '__esModule', { value: true });
    /******/ 	};
    /******/
    /******/ 	// create a fake namespace object
    /******/ 	// mode & 1: value is a module id, require it
    /******/ 	// mode & 2: merge all properties of value into the ns
    /******/ 	// mode & 4: return value when already ns object
    /******/ 	// mode & 8|1: behave like require
    /******/ 	__webpack_require__.t = function(value, mode) {
    /******/ 		if(mode & 1) value = __webpack_require__(value);
    /******/ 		if(mode & 8) return value;
    /******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
    /******/ 		var ns = Object.create(null);
    /******/ 		__webpack_require__.r(ns);
    /******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
    /******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
    /******/ 		return ns;
    /******/ 	};
    /******/
    /******/ 	// getDefaultExport function for compatibility with non-harmony modules
    /******/ 	__webpack_require__.n = function(module) {
    /******/ 		var getter = module && module.__esModule ?
    /******/ 			function getDefault() { return module['default']; } :
    /******/ 			function getModuleExports() { return module; };
    /******/ 		__webpack_require__.d(getter, 'a', getter);
    /******/ 		return getter;
    /******/ 	};
    /******/
    /******/ 	// Object.prototype.hasOwnProperty.call
    /******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
    /******/
    /******/ 	// __webpack_public_path__
    /******/ 	__webpack_require__.p = "";
    /******/
    /******/
    /******/ 	// Load entry module and return exports
    /******/ 	return __webpack_require__(__webpack_require__.s = 2);
    /******/ })
    /************************************************************************/
    /******/ ([
    /* 0 */
    /***/ (function(module, exports, __webpack_require__) {

    // Copyright (C) 2016 Dmitry Chestnykh
    // MIT License. See LICENSE file for details.
    var __extends = (this && this.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * Package base64 implements Base64 encoding and decoding.
     */
    // Invalid character used in decoding to indicate
    // that the character to decode is out of range of
    // alphabet and cannot be decoded.
    var INVALID_BYTE = 256;
    /**
     * Implements standard Base64 encoding.
     *
     * Operates in constant time.
     */
    var Coder = /** @class */ (function () {
        // TODO(dchest): methods to encode chunk-by-chunk.
        function Coder(_paddingCharacter) {
            if (_paddingCharacter === void 0) { _paddingCharacter = "="; }
            this._paddingCharacter = _paddingCharacter;
        }
        Coder.prototype.encodedLength = function (length) {
            if (!this._paddingCharacter) {
                return (length * 8 + 5) / 6 | 0;
            }
            return (length + 2) / 3 * 4 | 0;
        };
        Coder.prototype.encode = function (data) {
            var out = "";
            var i = 0;
            for (; i < data.length - 2; i += 3) {
                var c = (data[i] << 16) | (data[i + 1] << 8) | (data[i + 2]);
                out += this._encodeByte((c >>> 3 * 6) & 63);
                out += this._encodeByte((c >>> 2 * 6) & 63);
                out += this._encodeByte((c >>> 1 * 6) & 63);
                out += this._encodeByte((c >>> 0 * 6) & 63);
            }
            var left = data.length - i;
            if (left > 0) {
                var c = (data[i] << 16) | (left === 2 ? data[i + 1] << 8 : 0);
                out += this._encodeByte((c >>> 3 * 6) & 63);
                out += this._encodeByte((c >>> 2 * 6) & 63);
                if (left === 2) {
                    out += this._encodeByte((c >>> 1 * 6) & 63);
                }
                else {
                    out += this._paddingCharacter || "";
                }
                out += this._paddingCharacter || "";
            }
            return out;
        };
        Coder.prototype.maxDecodedLength = function (length) {
            if (!this._paddingCharacter) {
                return (length * 6 + 7) / 8 | 0;
            }
            return length / 4 * 3 | 0;
        };
        Coder.prototype.decodedLength = function (s) {
            return this.maxDecodedLength(s.length - this._getPaddingLength(s));
        };
        Coder.prototype.decode = function (s) {
            if (s.length === 0) {
                return new Uint8Array(0);
            }
            var paddingLength = this._getPaddingLength(s);
            var length = s.length - paddingLength;
            var out = new Uint8Array(this.maxDecodedLength(length));
            var op = 0;
            var i = 0;
            var haveBad = 0;
            var v0 = 0, v1 = 0, v2 = 0, v3 = 0;
            for (; i < length - 4; i += 4) {
                v0 = this._decodeChar(s.charCodeAt(i + 0));
                v1 = this._decodeChar(s.charCodeAt(i + 1));
                v2 = this._decodeChar(s.charCodeAt(i + 2));
                v3 = this._decodeChar(s.charCodeAt(i + 3));
                out[op++] = (v0 << 2) | (v1 >>> 4);
                out[op++] = (v1 << 4) | (v2 >>> 2);
                out[op++] = (v2 << 6) | v3;
                haveBad |= v0 & INVALID_BYTE;
                haveBad |= v1 & INVALID_BYTE;
                haveBad |= v2 & INVALID_BYTE;
                haveBad |= v3 & INVALID_BYTE;
            }
            if (i < length - 1) {
                v0 = this._decodeChar(s.charCodeAt(i));
                v1 = this._decodeChar(s.charCodeAt(i + 1));
                out[op++] = (v0 << 2) | (v1 >>> 4);
                haveBad |= v0 & INVALID_BYTE;
                haveBad |= v1 & INVALID_BYTE;
            }
            if (i < length - 2) {
                v2 = this._decodeChar(s.charCodeAt(i + 2));
                out[op++] = (v1 << 4) | (v2 >>> 2);
                haveBad |= v2 & INVALID_BYTE;
            }
            if (i < length - 3) {
                v3 = this._decodeChar(s.charCodeAt(i + 3));
                out[op++] = (v2 << 6) | v3;
                haveBad |= v3 & INVALID_BYTE;
            }
            if (haveBad !== 0) {
                throw new Error("Base64Coder: incorrect characters for decoding");
            }
            return out;
        };
        // Standard encoding have the following encoded/decoded ranges,
        // which we need to convert between.
        //
        // ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789  +   /
        // Index:   0 - 25                    26 - 51              52 - 61   62  63
        // ASCII:  65 - 90                    97 - 122             48 - 57   43  47
        //
        // Encode 6 bits in b into a new character.
        Coder.prototype._encodeByte = function (b) {
            // Encoding uses constant time operations as follows:
            //
            // 1. Define comparison of A with B using (A - B) >>> 8:
            //          if A > B, then result is positive integer
            //          if A <= B, then result is 0
            //
            // 2. Define selection of C or 0 using bitwise AND: X & C:
            //          if X == 0, then result is 0
            //          if X != 0, then result is C
            //
            // 3. Start with the smallest comparison (b >= 0), which is always
            //    true, so set the result to the starting ASCII value (65).
            //
            // 4. Continue comparing b to higher ASCII values, and selecting
            //    zero if comparison isn't true, otherwise selecting a value
            //    to add to result, which:
            //
            //          a) undoes the previous addition
            //          b) provides new value to add
            //
            var result = b;
            // b >= 0
            result += 65;
            // b > 25
            result += ((25 - b) >>> 8) & ((0 - 65) - 26 + 97);
            // b > 51
            result += ((51 - b) >>> 8) & ((26 - 97) - 52 + 48);
            // b > 61
            result += ((61 - b) >>> 8) & ((52 - 48) - 62 + 43);
            // b > 62
            result += ((62 - b) >>> 8) & ((62 - 43) - 63 + 47);
            return String.fromCharCode(result);
        };
        // Decode a character code into a byte.
        // Must return 256 if character is out of alphabet range.
        Coder.prototype._decodeChar = function (c) {
            // Decoding works similar to encoding: using the same comparison
            // function, but now it works on ranges: result is always incremented
            // by value, but this value becomes zero if the range is not
            // satisfied.
            //
            // Decoding starts with invalid value, 256, which is then
            // subtracted when the range is satisfied. If none of the ranges
            // apply, the function returns 256, which is then checked by
            // the caller to throw error.
            var result = INVALID_BYTE; // start with invalid character
            // c == 43 (c > 42 and c < 44)
            result += (((42 - c) & (c - 44)) >>> 8) & (-INVALID_BYTE + c - 43 + 62);
            // c == 47 (c > 46 and c < 48)
            result += (((46 - c) & (c - 48)) >>> 8) & (-INVALID_BYTE + c - 47 + 63);
            // c > 47 and c < 58
            result += (((47 - c) & (c - 58)) >>> 8) & (-INVALID_BYTE + c - 48 + 52);
            // c > 64 and c < 91
            result += (((64 - c) & (c - 91)) >>> 8) & (-INVALID_BYTE + c - 65 + 0);
            // c > 96 and c < 123
            result += (((96 - c) & (c - 123)) >>> 8) & (-INVALID_BYTE + c - 97 + 26);
            return result;
        };
        Coder.prototype._getPaddingLength = function (s) {
            var paddingLength = 0;
            if (this._paddingCharacter) {
                for (var i = s.length - 1; i >= 0; i--) {
                    if (s[i] !== this._paddingCharacter) {
                        break;
                    }
                    paddingLength++;
                }
                if (s.length < 4 || paddingLength > 2) {
                    throw new Error("Base64Coder: incorrect padding");
                }
            }
            return paddingLength;
        };
        return Coder;
    }());
    exports.Coder = Coder;
    var stdCoder = new Coder();
    function encode(data) {
        return stdCoder.encode(data);
    }
    exports.encode = encode;
    function decode(s) {
        return stdCoder.decode(s);
    }
    exports.decode = decode;
    /**
     * Implements URL-safe Base64 encoding.
     * (Same as Base64, but '+' is replaced with '-', and '/' with '_').
     *
     * Operates in constant time.
     */
    var URLSafeCoder = /** @class */ (function (_super) {
        __extends(URLSafeCoder, _super);
        function URLSafeCoder() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        // URL-safe encoding have the following encoded/decoded ranges:
        //
        // ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789  -   _
        // Index:   0 - 25                    26 - 51              52 - 61   62  63
        // ASCII:  65 - 90                    97 - 122             48 - 57   45  95
        //
        URLSafeCoder.prototype._encodeByte = function (b) {
            var result = b;
            // b >= 0
            result += 65;
            // b > 25
            result += ((25 - b) >>> 8) & ((0 - 65) - 26 + 97);
            // b > 51
            result += ((51 - b) >>> 8) & ((26 - 97) - 52 + 48);
            // b > 61
            result += ((61 - b) >>> 8) & ((52 - 48) - 62 + 45);
            // b > 62
            result += ((62 - b) >>> 8) & ((62 - 45) - 63 + 95);
            return String.fromCharCode(result);
        };
        URLSafeCoder.prototype._decodeChar = function (c) {
            var result = INVALID_BYTE;
            // c == 45 (c > 44 and c < 46)
            result += (((44 - c) & (c - 46)) >>> 8) & (-INVALID_BYTE + c - 45 + 62);
            // c == 95 (c > 94 and c < 96)
            result += (((94 - c) & (c - 96)) >>> 8) & (-INVALID_BYTE + c - 95 + 63);
            // c > 47 and c < 58
            result += (((47 - c) & (c - 58)) >>> 8) & (-INVALID_BYTE + c - 48 + 52);
            // c > 64 and c < 91
            result += (((64 - c) & (c - 91)) >>> 8) & (-INVALID_BYTE + c - 65 + 0);
            // c > 96 and c < 123
            result += (((96 - c) & (c - 123)) >>> 8) & (-INVALID_BYTE + c - 97 + 26);
            return result;
        };
        return URLSafeCoder;
    }(Coder));
    exports.URLSafeCoder = URLSafeCoder;
    var urlSafeCoder = new URLSafeCoder();
    function encodeURLSafe(data) {
        return urlSafeCoder.encode(data);
    }
    exports.encodeURLSafe = encodeURLSafe;
    function decodeURLSafe(s) {
        return urlSafeCoder.decode(s);
    }
    exports.decodeURLSafe = decodeURLSafe;
    exports.encodedLength = function (length) {
        return stdCoder.encodedLength(length);
    };
    exports.maxDecodedLength = function (length) {
        return stdCoder.maxDecodedLength(length);
    };
    exports.decodedLength = function (s) {
        return stdCoder.decodedLength(s);
    };


    /***/ }),
    /* 1 */
    /***/ (function(module, exports, __webpack_require__) {

    // Copyright (C) 2016 Dmitry Chestnykh
    // MIT License. See LICENSE file for details.
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * Package utf8 implements UTF-8 encoding and decoding.
     */
    var INVALID_UTF16 = "utf8: invalid string";
    var INVALID_UTF8 = "utf8: invalid source encoding";
    /**
     * Encodes the given string into UTF-8 byte array.
     * Throws if the source string has invalid UTF-16 encoding.
     */
    function encode(s) {
        // Calculate result length and allocate output array.
        // encodedLength() also validates string and throws errors,
        // so we don't need repeat validation here.
        var arr = new Uint8Array(encodedLength(s));
        var pos = 0;
        for (var i = 0; i < s.length; i++) {
            var c = s.charCodeAt(i);
            if (c < 0x80) {
                arr[pos++] = c;
            }
            else if (c < 0x800) {
                arr[pos++] = 0xc0 | c >> 6;
                arr[pos++] = 0x80 | c & 0x3f;
            }
            else if (c < 0xd800) {
                arr[pos++] = 0xe0 | c >> 12;
                arr[pos++] = 0x80 | (c >> 6) & 0x3f;
                arr[pos++] = 0x80 | c & 0x3f;
            }
            else {
                i++; // get one more character
                c = (c & 0x3ff) << 10;
                c |= s.charCodeAt(i) & 0x3ff;
                c += 0x10000;
                arr[pos++] = 0xf0 | c >> 18;
                arr[pos++] = 0x80 | (c >> 12) & 0x3f;
                arr[pos++] = 0x80 | (c >> 6) & 0x3f;
                arr[pos++] = 0x80 | c & 0x3f;
            }
        }
        return arr;
    }
    exports.encode = encode;
    /**
     * Returns the number of bytes required to encode the given string into UTF-8.
     * Throws if the source string has invalid UTF-16 encoding.
     */
    function encodedLength(s) {
        var result = 0;
        for (var i = 0; i < s.length; i++) {
            var c = s.charCodeAt(i);
            if (c < 0x80) {
                result += 1;
            }
            else if (c < 0x800) {
                result += 2;
            }
            else if (c < 0xd800) {
                result += 3;
            }
            else if (c <= 0xdfff) {
                if (i >= s.length - 1) {
                    throw new Error(INVALID_UTF16);
                }
                i++; // "eat" next character
                result += 4;
            }
            else {
                throw new Error(INVALID_UTF16);
            }
        }
        return result;
    }
    exports.encodedLength = encodedLength;
    /**
     * Decodes the given byte array from UTF-8 into a string.
     * Throws if encoding is invalid.
     */
    function decode(arr) {
        var chars = [];
        for (var i = 0; i < arr.length; i++) {
            var b = arr[i];
            if (b & 0x80) {
                var min = void 0;
                if (b < 0xe0) {
                    // Need 1 more byte.
                    if (i >= arr.length) {
                        throw new Error(INVALID_UTF8);
                    }
                    var n1 = arr[++i];
                    if ((n1 & 0xc0) !== 0x80) {
                        throw new Error(INVALID_UTF8);
                    }
                    b = (b & 0x1f) << 6 | (n1 & 0x3f);
                    min = 0x80;
                }
                else if (b < 0xf0) {
                    // Need 2 more bytes.
                    if (i >= arr.length - 1) {
                        throw new Error(INVALID_UTF8);
                    }
                    var n1 = arr[++i];
                    var n2 = arr[++i];
                    if ((n1 & 0xc0) !== 0x80 || (n2 & 0xc0) !== 0x80) {
                        throw new Error(INVALID_UTF8);
                    }
                    b = (b & 0x0f) << 12 | (n1 & 0x3f) << 6 | (n2 & 0x3f);
                    min = 0x800;
                }
                else if (b < 0xf8) {
                    // Need 3 more bytes.
                    if (i >= arr.length - 2) {
                        throw new Error(INVALID_UTF8);
                    }
                    var n1 = arr[++i];
                    var n2 = arr[++i];
                    var n3 = arr[++i];
                    if ((n1 & 0xc0) !== 0x80 || (n2 & 0xc0) !== 0x80 || (n3 & 0xc0) !== 0x80) {
                        throw new Error(INVALID_UTF8);
                    }
                    b = (b & 0x0f) << 18 | (n1 & 0x3f) << 12 | (n2 & 0x3f) << 6 | (n3 & 0x3f);
                    min = 0x10000;
                }
                else {
                    throw new Error(INVALID_UTF8);
                }
                if (b < min || (b >= 0xd800 && b <= 0xdfff)) {
                    throw new Error(INVALID_UTF8);
                }
                if (b >= 0x10000) {
                    // Surrogate pair.
                    if (b > 0x10ffff) {
                        throw new Error(INVALID_UTF8);
                    }
                    b -= 0x10000;
                    chars.push(String.fromCharCode(0xd800 | (b >> 10)));
                    b = 0xdc00 | (b & 0x3ff);
                }
            }
            chars.push(String.fromCharCode(b));
        }
        return chars.join("");
    }
    exports.decode = decode;


    /***/ }),
    /* 2 */
    /***/ (function(module, exports, __webpack_require__) {

    // required so we don't have to do require('pusher').default etc.
    module.exports = __webpack_require__(3).default;


    /***/ }),
    /* 3 */
    /***/ (function(module, __webpack_exports__, __webpack_require__) {
    __webpack_require__.r(__webpack_exports__);

    // CONCATENATED MODULE: ./src/runtimes/web/dom/script_receiver_factory.ts
    var ScriptReceiverFactory = (function () {
        function ScriptReceiverFactory(prefix, name) {
            this.lastId = 0;
            this.prefix = prefix;
            this.name = name;
        }
        ScriptReceiverFactory.prototype.create = function (callback) {
            this.lastId++;
            var number = this.lastId;
            var id = this.prefix + number;
            var name = this.name + '[' + number + ']';
            var called = false;
            var callbackWrapper = function () {
                if (!called) {
                    callback.apply(null, arguments);
                    called = true;
                }
            };
            this[number] = callbackWrapper;
            return { number: number, id: id, name: name, callback: callbackWrapper };
        };
        ScriptReceiverFactory.prototype.remove = function (receiver) {
            delete this[receiver.number];
        };
        return ScriptReceiverFactory;
    }());

    var ScriptReceivers = new ScriptReceiverFactory('_pusher_script_', 'Pusher.ScriptReceivers');

    // CONCATENATED MODULE: ./src/core/defaults.ts
    var Defaults = {
        VERSION: "7.0.3",
        PROTOCOL: 7,
        wsPort: 80,
        wssPort: 443,
        wsPath: '',
        httpHost: 'sockjs.pusher.com',
        httpPort: 80,
        httpsPort: 443,
        httpPath: '/pusher',
        stats_host: 'stats.pusher.com',
        authEndpoint: '/pusher/auth',
        authTransport: 'ajax',
        activityTimeout: 120000,
        pongTimeout: 30000,
        unavailableTimeout: 10000,
        cluster: 'mt1',
        cdn_http: "http://js.pusher.com",
        cdn_https: "https://js.pusher.com",
        dependency_suffix: ""
    };
    /* harmony default export */ var defaults = (Defaults);

    // CONCATENATED MODULE: ./src/runtimes/web/dom/dependency_loader.ts


    var dependency_loader_DependencyLoader = (function () {
        function DependencyLoader(options) {
            this.options = options;
            this.receivers = options.receivers || ScriptReceivers;
            this.loading = {};
        }
        DependencyLoader.prototype.load = function (name, options, callback) {
            var self = this;
            if (self.loading[name] && self.loading[name].length > 0) {
                self.loading[name].push(callback);
            }
            else {
                self.loading[name] = [callback];
                var request = runtime.createScriptRequest(self.getPath(name, options));
                var receiver = self.receivers.create(function (error) {
                    self.receivers.remove(receiver);
                    if (self.loading[name]) {
                        var callbacks = self.loading[name];
                        delete self.loading[name];
                        var successCallback = function (wasSuccessful) {
                            if (!wasSuccessful) {
                                request.cleanup();
                            }
                        };
                        for (var i = 0; i < callbacks.length; i++) {
                            callbacks[i](error, successCallback);
                        }
                    }
                });
                request.send(receiver);
            }
        };
        DependencyLoader.prototype.getRoot = function (options) {
            var cdn;
            var protocol = runtime.getDocument().location.protocol;
            if ((options && options.useTLS) || protocol === 'https:') {
                cdn = this.options.cdn_https;
            }
            else {
                cdn = this.options.cdn_http;
            }
            return cdn.replace(/\/*$/, '') + '/' + this.options.version;
        };
        DependencyLoader.prototype.getPath = function (name, options) {
            return this.getRoot(options) + '/' + name + this.options.suffix + '.js';
        };
        return DependencyLoader;
    }());
    /* harmony default export */ var dependency_loader = (dependency_loader_DependencyLoader);

    // CONCATENATED MODULE: ./src/runtimes/web/dom/dependencies.ts



    var DependenciesReceivers = new ScriptReceiverFactory('_pusher_dependencies', 'Pusher.DependenciesReceivers');
    var Dependencies = new dependency_loader({
        cdn_http: defaults.cdn_http,
        cdn_https: defaults.cdn_https,
        version: defaults.VERSION,
        suffix: defaults.dependency_suffix,
        receivers: DependenciesReceivers
    });

    // CONCATENATED MODULE: ./src/core/utils/url_store.ts
    var urlStore = {
        baseUrl: 'https://pusher.com',
        urls: {
            authenticationEndpoint: {
                path: '/docs/authenticating_users'
            },
            javascriptQuickStart: {
                path: '/docs/javascript_quick_start'
            },
            triggeringClientEvents: {
                path: '/docs/client_api_guide/client_events#trigger-events'
            },
            encryptedChannelSupport: {
                fullUrl: 'https://github.com/pusher/pusher-js/tree/cc491015371a4bde5743d1c87a0fbac0feb53195#encrypted-channel-support'
            }
        }
    };
    var buildLogSuffix = function (key) {
        var urlPrefix = 'See:';
        var urlObj = urlStore.urls[key];
        if (!urlObj)
            return '';
        var url;
        if (urlObj.fullUrl) {
            url = urlObj.fullUrl;
        }
        else if (urlObj.path) {
            url = urlStore.baseUrl + urlObj.path;
        }
        if (!url)
            return '';
        return urlPrefix + " " + url;
    };
    /* harmony default export */ var url_store = ({ buildLogSuffix: buildLogSuffix });

    // CONCATENATED MODULE: ./src/core/errors.ts
    var __extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var BadEventName = (function (_super) {
        __extends(BadEventName, _super);
        function BadEventName(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return BadEventName;
    }(Error));

    var RequestTimedOut = (function (_super) {
        __extends(RequestTimedOut, _super);
        function RequestTimedOut(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return RequestTimedOut;
    }(Error));

    var TransportPriorityTooLow = (function (_super) {
        __extends(TransportPriorityTooLow, _super);
        function TransportPriorityTooLow(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return TransportPriorityTooLow;
    }(Error));

    var TransportClosed = (function (_super) {
        __extends(TransportClosed, _super);
        function TransportClosed(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return TransportClosed;
    }(Error));

    var UnsupportedFeature = (function (_super) {
        __extends(UnsupportedFeature, _super);
        function UnsupportedFeature(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return UnsupportedFeature;
    }(Error));

    var UnsupportedTransport = (function (_super) {
        __extends(UnsupportedTransport, _super);
        function UnsupportedTransport(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return UnsupportedTransport;
    }(Error));

    var UnsupportedStrategy = (function (_super) {
        __extends(UnsupportedStrategy, _super);
        function UnsupportedStrategy(msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return UnsupportedStrategy;
    }(Error));

    var HTTPAuthError = (function (_super) {
        __extends(HTTPAuthError, _super);
        function HTTPAuthError(status, msg) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, msg) || this;
            _this.status = status;
            Object.setPrototypeOf(_this, _newTarget.prototype);
            return _this;
        }
        return HTTPAuthError;
    }(Error));


    // CONCATENATED MODULE: ./src/runtimes/isomorphic/auth/xhr_auth.ts



    var ajax = function (context, socketId, callback) {
        var self = this, xhr;
        xhr = runtime.createXHR();
        xhr.open('POST', self.options.authEndpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        for (var headerName in this.authOptions.headers) {
            xhr.setRequestHeader(headerName, this.authOptions.headers[headerName]);
        }
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var data = void 0;
                    var parsed = false;
                    try {
                        data = JSON.parse(xhr.responseText);
                        parsed = true;
                    }
                    catch (e) {
                        callback(new HTTPAuthError(200, 'JSON returned from auth endpoint was invalid, yet status code was 200. Data was: ' +
                            xhr.responseText), { auth: '' });
                    }
                    if (parsed) {
                        callback(null, data);
                    }
                }
                else {
                    var suffix = url_store.buildLogSuffix('authenticationEndpoint');
                    callback(new HTTPAuthError(xhr.status, 'Unable to retrieve auth string from auth endpoint - ' +
                        ("received status: " + xhr.status + " from " + self.options.authEndpoint + ". ") +
                        ("Clients must be authenticated to join private or presence channels. " + suffix)), { auth: '' });
                }
            }
        };
        xhr.send(this.composeQuery(socketId));
        return xhr;
    };
    /* harmony default export */ var xhr_auth = (ajax);

    // CONCATENATED MODULE: ./src/core/base64.ts
    function encode(s) {
        return btoa(utob(s));
    }
    var fromCharCode = String.fromCharCode;
    var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var b64tab = {};
    for (var base64_i = 0, l = b64chars.length; base64_i < l; base64_i++) {
        b64tab[b64chars.charAt(base64_i)] = base64_i;
    }
    var cb_utob = function (c) {
        var cc = c.charCodeAt(0);
        return cc < 0x80
            ? c
            : cc < 0x800
                ? fromCharCode(0xc0 | (cc >>> 6)) + fromCharCode(0x80 | (cc & 0x3f))
                : fromCharCode(0xe0 | ((cc >>> 12) & 0x0f)) +
                    fromCharCode(0x80 | ((cc >>> 6) & 0x3f)) +
                    fromCharCode(0x80 | (cc & 0x3f));
    };
    var utob = function (u) {
        return u.replace(/[^\x00-\x7F]/g, cb_utob);
    };
    var cb_encode = function (ccc) {
        var padlen = [0, 2, 1][ccc.length % 3];
        var ord = (ccc.charCodeAt(0) << 16) |
            ((ccc.length > 1 ? ccc.charCodeAt(1) : 0) << 8) |
            (ccc.length > 2 ? ccc.charCodeAt(2) : 0);
        var chars = [
            b64chars.charAt(ord >>> 18),
            b64chars.charAt((ord >>> 12) & 63),
            padlen >= 2 ? '=' : b64chars.charAt((ord >>> 6) & 63),
            padlen >= 1 ? '=' : b64chars.charAt(ord & 63)
        ];
        return chars.join('');
    };
    var btoa = window.btoa ||
        function (b) {
            return b.replace(/[\s\S]{1,3}/g, cb_encode);
        };

    // CONCATENATED MODULE: ./src/core/utils/timers/abstract_timer.ts
    var Timer = (function () {
        function Timer(set, clear, delay, callback) {
            var _this = this;
            this.clear = clear;
            this.timer = set(function () {
                if (_this.timer) {
                    _this.timer = callback(_this.timer);
                }
            }, delay);
        }
        Timer.prototype.isRunning = function () {
            return this.timer !== null;
        };
        Timer.prototype.ensureAborted = function () {
            if (this.timer) {
                this.clear(this.timer);
                this.timer = null;
            }
        };
        return Timer;
    }());
    /* harmony default export */ var abstract_timer = (Timer);

    // CONCATENATED MODULE: ./src/core/utils/timers/index.ts
    var timers_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();

    function timers_clearTimeout(timer) {
        window.clearTimeout(timer);
    }
    function timers_clearInterval(timer) {
        window.clearInterval(timer);
    }
    var OneOffTimer = (function (_super) {
        timers_extends(OneOffTimer, _super);
        function OneOffTimer(delay, callback) {
            return _super.call(this, setTimeout, timers_clearTimeout, delay, function (timer) {
                callback();
                return null;
            }) || this;
        }
        return OneOffTimer;
    }(abstract_timer));

    var PeriodicTimer = (function (_super) {
        timers_extends(PeriodicTimer, _super);
        function PeriodicTimer(delay, callback) {
            return _super.call(this, setInterval, timers_clearInterval, delay, function (timer) {
                callback();
                return timer;
            }) || this;
        }
        return PeriodicTimer;
    }(abstract_timer));


    // CONCATENATED MODULE: ./src/core/util.ts

    var Util = {
        now: function () {
            if (Date.now) {
                return Date.now();
            }
            else {
                return new Date().valueOf();
            }
        },
        defer: function (callback) {
            return new OneOffTimer(0, callback);
        },
        method: function (name) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            var boundArguments = Array.prototype.slice.call(arguments, 1);
            return function (object) {
                return object[name].apply(object, boundArguments.concat(arguments));
            };
        }
    };
    /* harmony default export */ var util = (Util);

    // CONCATENATED MODULE: ./src/core/utils/collections.ts


    function extend(target) {
        var sources = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            sources[_i - 1] = arguments[_i];
        }
        for (var i = 0; i < sources.length; i++) {
            var extensions = sources[i];
            for (var property in extensions) {
                if (extensions[property] &&
                    extensions[property].constructor &&
                    extensions[property].constructor === Object) {
                    target[property] = extend(target[property] || {}, extensions[property]);
                }
                else {
                    target[property] = extensions[property];
                }
            }
        }
        return target;
    }
    function stringify() {
        var m = ['Pusher'];
        for (var i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] === 'string') {
                m.push(arguments[i]);
            }
            else {
                m.push(safeJSONStringify(arguments[i]));
            }
        }
        return m.join(' : ');
    }
    function arrayIndexOf(array, item) {
        var nativeIndexOf = Array.prototype.indexOf;
        if (array === null) {
            return -1;
        }
        if (nativeIndexOf && array.indexOf === nativeIndexOf) {
            return array.indexOf(item);
        }
        for (var i = 0, l = array.length; i < l; i++) {
            if (array[i] === item) {
                return i;
            }
        }
        return -1;
    }
    function objectApply(object, f) {
        for (var key in object) {
            if (Object.prototype.hasOwnProperty.call(object, key)) {
                f(object[key], key, object);
            }
        }
    }
    function keys(object) {
        var keys = [];
        objectApply(object, function (_, key) {
            keys.push(key);
        });
        return keys;
    }
    function values(object) {
        var values = [];
        objectApply(object, function (value) {
            values.push(value);
        });
        return values;
    }
    function apply(array, f, context) {
        for (var i = 0; i < array.length; i++) {
            f.call(context || window, array[i], i, array);
        }
    }
    function map(array, f) {
        var result = [];
        for (var i = 0; i < array.length; i++) {
            result.push(f(array[i], i, array, result));
        }
        return result;
    }
    function mapObject(object, f) {
        var result = {};
        objectApply(object, function (value, key) {
            result[key] = f(value);
        });
        return result;
    }
    function filter(array, test) {
        test =
            test ||
                function (value) {
                    return !!value;
                };
        var result = [];
        for (var i = 0; i < array.length; i++) {
            if (test(array[i], i, array, result)) {
                result.push(array[i]);
            }
        }
        return result;
    }
    function filterObject(object, test) {
        var result = {};
        objectApply(object, function (value, key) {
            if ((test && test(value, key, object, result)) || Boolean(value)) {
                result[key] = value;
            }
        });
        return result;
    }
    function flatten(object) {
        var result = [];
        objectApply(object, function (value, key) {
            result.push([key, value]);
        });
        return result;
    }
    function any(array, test) {
        for (var i = 0; i < array.length; i++) {
            if (test(array[i], i, array)) {
                return true;
            }
        }
        return false;
    }
    function collections_all(array, test) {
        for (var i = 0; i < array.length; i++) {
            if (!test(array[i], i, array)) {
                return false;
            }
        }
        return true;
    }
    function encodeParamsObject(data) {
        return mapObject(data, function (value) {
            if (typeof value === 'object') {
                value = safeJSONStringify(value);
            }
            return encodeURIComponent(encode(value.toString()));
        });
    }
    function buildQueryString(data) {
        var params = filterObject(data, function (value) {
            return value !== undefined;
        });
        var query = map(flatten(encodeParamsObject(params)), util.method('join', '=')).join('&');
        return query;
    }
    function decycleObject(object) {
        var objects = [], paths = [];
        return (function derez(value, path) {
            var i, name, nu;
            switch (typeof value) {
                case 'object':
                    if (!value) {
                        return null;
                    }
                    for (i = 0; i < objects.length; i += 1) {
                        if (objects[i] === value) {
                            return { $ref: paths[i] };
                        }
                    }
                    objects.push(value);
                    paths.push(path);
                    if (Object.prototype.toString.apply(value) === '[object Array]') {
                        nu = [];
                        for (i = 0; i < value.length; i += 1) {
                            nu[i] = derez(value[i], path + '[' + i + ']');
                        }
                    }
                    else {
                        nu = {};
                        for (name in value) {
                            if (Object.prototype.hasOwnProperty.call(value, name)) {
                                nu[name] = derez(value[name], path + '[' + JSON.stringify(name) + ']');
                            }
                        }
                    }
                    return nu;
                case 'number':
                case 'string':
                case 'boolean':
                    return value;
            }
        })(object, '$');
    }
    function safeJSONStringify(source) {
        try {
            return JSON.stringify(source);
        }
        catch (e) {
            return JSON.stringify(decycleObject(source));
        }
    }

    // CONCATENATED MODULE: ./src/core/logger.ts


    var logger_Logger = (function () {
        function Logger() {
            this.globalLog = function (message) {
                if (window.console && window.console.log) {
                    window.console.log(message);
                }
            };
        }
        Logger.prototype.debug = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            this.log(this.globalLog, args);
        };
        Logger.prototype.warn = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            this.log(this.globalLogWarn, args);
        };
        Logger.prototype.error = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            this.log(this.globalLogError, args);
        };
        Logger.prototype.globalLogWarn = function (message) {
            if (window.console && window.console.warn) {
                window.console.warn(message);
            }
            else {
                this.globalLog(message);
            }
        };
        Logger.prototype.globalLogError = function (message) {
            if (window.console && window.console.error) {
                window.console.error(message);
            }
            else {
                this.globalLogWarn(message);
            }
        };
        Logger.prototype.log = function (defaultLoggingFunction) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            var message = stringify.apply(this, arguments);
            if (core_pusher.log) {
                core_pusher.log(message);
            }
            else if (core_pusher.logToConsole) {
                var log = defaultLoggingFunction.bind(this);
                log(message);
            }
        };
        return Logger;
    }());
    /* harmony default export */ var logger = (new logger_Logger());

    // CONCATENATED MODULE: ./src/runtimes/web/auth/jsonp_auth.ts

    var jsonp = function (context, socketId, callback) {
        if (this.authOptions.headers !== undefined) {
            logger.warn('To send headers with the auth request, you must use AJAX, rather than JSONP.');
        }
        var callbackName = context.nextAuthCallbackID.toString();
        context.nextAuthCallbackID++;
        var document = context.getDocument();
        var script = document.createElement('script');
        context.auth_callbacks[callbackName] = function (data) {
            callback(null, data);
        };
        var callback_name = "Pusher.auth_callbacks['" + callbackName + "']";
        script.src =
            this.options.authEndpoint +
                '?callback=' +
                encodeURIComponent(callback_name) +
                '&' +
                this.composeQuery(socketId);
        var head = document.getElementsByTagName('head')[0] || document.documentElement;
        head.insertBefore(script, head.firstChild);
    };
    /* harmony default export */ var jsonp_auth = (jsonp);

    // CONCATENATED MODULE: ./src/runtimes/web/dom/script_request.ts
    var ScriptRequest = (function () {
        function ScriptRequest(src) {
            this.src = src;
        }
        ScriptRequest.prototype.send = function (receiver) {
            var self = this;
            var errorString = 'Error loading ' + self.src;
            self.script = document.createElement('script');
            self.script.id = receiver.id;
            self.script.src = self.src;
            self.script.type = 'text/javascript';
            self.script.charset = 'UTF-8';
            if (self.script.addEventListener) {
                self.script.onerror = function () {
                    receiver.callback(errorString);
                };
                self.script.onload = function () {
                    receiver.callback(null);
                };
            }
            else {
                self.script.onreadystatechange = function () {
                    if (self.script.readyState === 'loaded' ||
                        self.script.readyState === 'complete') {
                        receiver.callback(null);
                    }
                };
            }
            if (self.script.async === undefined &&
                document.attachEvent &&
                /opera/i.test(navigator.userAgent)) {
                self.errorScript = document.createElement('script');
                self.errorScript.id = receiver.id + '_error';
                self.errorScript.text = receiver.name + "('" + errorString + "');";
                self.script.async = self.errorScript.async = false;
            }
            else {
                self.script.async = true;
            }
            var head = document.getElementsByTagName('head')[0];
            head.insertBefore(self.script, head.firstChild);
            if (self.errorScript) {
                head.insertBefore(self.errorScript, self.script.nextSibling);
            }
        };
        ScriptRequest.prototype.cleanup = function () {
            if (this.script) {
                this.script.onload = this.script.onerror = null;
                this.script.onreadystatechange = null;
            }
            if (this.script && this.script.parentNode) {
                this.script.parentNode.removeChild(this.script);
            }
            if (this.errorScript && this.errorScript.parentNode) {
                this.errorScript.parentNode.removeChild(this.errorScript);
            }
            this.script = null;
            this.errorScript = null;
        };
        return ScriptRequest;
    }());
    /* harmony default export */ var script_request = (ScriptRequest);

    // CONCATENATED MODULE: ./src/runtimes/web/dom/jsonp_request.ts


    var jsonp_request_JSONPRequest = (function () {
        function JSONPRequest(url, data) {
            this.url = url;
            this.data = data;
        }
        JSONPRequest.prototype.send = function (receiver) {
            if (this.request) {
                return;
            }
            var query = buildQueryString(this.data);
            var url = this.url + '/' + receiver.number + '?' + query;
            this.request = runtime.createScriptRequest(url);
            this.request.send(receiver);
        };
        JSONPRequest.prototype.cleanup = function () {
            if (this.request) {
                this.request.cleanup();
            }
        };
        return JSONPRequest;
    }());
    /* harmony default export */ var jsonp_request = (jsonp_request_JSONPRequest);

    // CONCATENATED MODULE: ./src/runtimes/web/timeline/jsonp_timeline.ts


    var getAgent = function (sender, useTLS) {
        return function (data, callback) {
            var scheme = 'http' + (useTLS ? 's' : '') + '://';
            var url = scheme + (sender.host || sender.options.host) + sender.options.path;
            var request = runtime.createJSONPRequest(url, data);
            var receiver = runtime.ScriptReceivers.create(function (error, result) {
                ScriptReceivers.remove(receiver);
                request.cleanup();
                if (result && result.host) {
                    sender.host = result.host;
                }
                if (callback) {
                    callback(error, result);
                }
            });
            request.send(receiver);
        };
    };
    var jsonp_timeline_jsonp = {
        name: 'jsonp',
        getAgent: getAgent
    };
    /* harmony default export */ var jsonp_timeline = (jsonp_timeline_jsonp);

    // CONCATENATED MODULE: ./src/core/transports/url_schemes.ts

    function getGenericURL(baseScheme, params, path) {
        var scheme = baseScheme + (params.useTLS ? 's' : '');
        var host = params.useTLS ? params.hostTLS : params.hostNonTLS;
        return scheme + '://' + host + path;
    }
    function getGenericPath(key, queryString) {
        var path = '/app/' + key;
        var query = '?protocol=' +
            defaults.PROTOCOL +
            '&client=js' +
            '&version=' +
            defaults.VERSION +
            (queryString ? '&' + queryString : '');
        return path + query;
    }
    var ws = {
        getInitial: function (key, params) {
            var path = (params.httpPath || '') + getGenericPath(key, 'flash=false');
            return getGenericURL('ws', params, path);
        }
    };
    var http = {
        getInitial: function (key, params) {
            var path = (params.httpPath || '/pusher') + getGenericPath(key);
            return getGenericURL('http', params, path);
        }
    };
    var sockjs = {
        getInitial: function (key, params) {
            return getGenericURL('http', params, params.httpPath || '/pusher');
        },
        getPath: function (key, params) {
            return getGenericPath(key);
        }
    };

    // CONCATENATED MODULE: ./src/core/events/callback_registry.ts

    var callback_registry_CallbackRegistry = (function () {
        function CallbackRegistry() {
            this._callbacks = {};
        }
        CallbackRegistry.prototype.get = function (name) {
            return this._callbacks[prefix(name)];
        };
        CallbackRegistry.prototype.add = function (name, callback, context) {
            var prefixedEventName = prefix(name);
            this._callbacks[prefixedEventName] =
                this._callbacks[prefixedEventName] || [];
            this._callbacks[prefixedEventName].push({
                fn: callback,
                context: context
            });
        };
        CallbackRegistry.prototype.remove = function (name, callback, context) {
            if (!name && !callback && !context) {
                this._callbacks = {};
                return;
            }
            var names = name ? [prefix(name)] : keys(this._callbacks);
            if (callback || context) {
                this.removeCallback(names, callback, context);
            }
            else {
                this.removeAllCallbacks(names);
            }
        };
        CallbackRegistry.prototype.removeCallback = function (names, callback, context) {
            apply(names, function (name) {
                this._callbacks[name] = filter(this._callbacks[name] || [], function (binding) {
                    return ((callback && callback !== binding.fn) ||
                        (context && context !== binding.context));
                });
                if (this._callbacks[name].length === 0) {
                    delete this._callbacks[name];
                }
            }, this);
        };
        CallbackRegistry.prototype.removeAllCallbacks = function (names) {
            apply(names, function (name) {
                delete this._callbacks[name];
            }, this);
        };
        return CallbackRegistry;
    }());
    /* harmony default export */ var callback_registry = (callback_registry_CallbackRegistry);
    function prefix(name) {
        return '_' + name;
    }

    // CONCATENATED MODULE: ./src/core/events/dispatcher.ts


    var dispatcher_Dispatcher = (function () {
        function Dispatcher(failThrough) {
            this.callbacks = new callback_registry();
            this.global_callbacks = [];
            this.failThrough = failThrough;
        }
        Dispatcher.prototype.bind = function (eventName, callback, context) {
            this.callbacks.add(eventName, callback, context);
            return this;
        };
        Dispatcher.prototype.bind_global = function (callback) {
            this.global_callbacks.push(callback);
            return this;
        };
        Dispatcher.prototype.unbind = function (eventName, callback, context) {
            this.callbacks.remove(eventName, callback, context);
            return this;
        };
        Dispatcher.prototype.unbind_global = function (callback) {
            if (!callback) {
                this.global_callbacks = [];
                return this;
            }
            this.global_callbacks = filter(this.global_callbacks || [], function (c) { return c !== callback; });
            return this;
        };
        Dispatcher.prototype.unbind_all = function () {
            this.unbind();
            this.unbind_global();
            return this;
        };
        Dispatcher.prototype.emit = function (eventName, data, metadata) {
            for (var i = 0; i < this.global_callbacks.length; i++) {
                this.global_callbacks[i](eventName, data);
            }
            var callbacks = this.callbacks.get(eventName);
            var args = [];
            if (metadata) {
                args.push(data, metadata);
            }
            else if (data) {
                args.push(data);
            }
            if (callbacks && callbacks.length > 0) {
                for (var i = 0; i < callbacks.length; i++) {
                    callbacks[i].fn.apply(callbacks[i].context || window, args);
                }
            }
            else if (this.failThrough) {
                this.failThrough(eventName, data);
            }
            return this;
        };
        return Dispatcher;
    }());
    /* harmony default export */ var dispatcher = (dispatcher_Dispatcher);

    // CONCATENATED MODULE: ./src/core/transports/transport_connection.ts
    var transport_connection_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();





    var transport_connection_TransportConnection = (function (_super) {
        transport_connection_extends(TransportConnection, _super);
        function TransportConnection(hooks, name, priority, key, options) {
            var _this = _super.call(this) || this;
            _this.initialize = runtime.transportConnectionInitializer;
            _this.hooks = hooks;
            _this.name = name;
            _this.priority = priority;
            _this.key = key;
            _this.options = options;
            _this.state = 'new';
            _this.timeline = options.timeline;
            _this.activityTimeout = options.activityTimeout;
            _this.id = _this.timeline.generateUniqueID();
            return _this;
        }
        TransportConnection.prototype.handlesActivityChecks = function () {
            return Boolean(this.hooks.handlesActivityChecks);
        };
        TransportConnection.prototype.supportsPing = function () {
            return Boolean(this.hooks.supportsPing);
        };
        TransportConnection.prototype.connect = function () {
            var _this = this;
            if (this.socket || this.state !== 'initialized') {
                return false;
            }
            var url = this.hooks.urls.getInitial(this.key, this.options);
            try {
                this.socket = this.hooks.getSocket(url, this.options);
            }
            catch (e) {
                util.defer(function () {
                    _this.onError(e);
                    _this.changeState('closed');
                });
                return false;
            }
            this.bindListeners();
            logger.debug('Connecting', { transport: this.name, url: url });
            this.changeState('connecting');
            return true;
        };
        TransportConnection.prototype.close = function () {
            if (this.socket) {
                this.socket.close();
                return true;
            }
            else {
                return false;
            }
        };
        TransportConnection.prototype.send = function (data) {
            var _this = this;
            if (this.state === 'open') {
                util.defer(function () {
                    if (_this.socket) {
                        _this.socket.send(data);
                    }
                });
                return true;
            }
            else {
                return false;
            }
        };
        TransportConnection.prototype.ping = function () {
            if (this.state === 'open' && this.supportsPing()) {
                this.socket.ping();
            }
        };
        TransportConnection.prototype.onOpen = function () {
            if (this.hooks.beforeOpen) {
                this.hooks.beforeOpen(this.socket, this.hooks.urls.getPath(this.key, this.options));
            }
            this.changeState('open');
            this.socket.onopen = undefined;
        };
        TransportConnection.prototype.onError = function (error) {
            this.emit('error', { type: 'WebSocketError', error: error });
            this.timeline.error(this.buildTimelineMessage({ error: error.toString() }));
        };
        TransportConnection.prototype.onClose = function (closeEvent) {
            if (closeEvent) {
                this.changeState('closed', {
                    code: closeEvent.code,
                    reason: closeEvent.reason,
                    wasClean: closeEvent.wasClean
                });
            }
            else {
                this.changeState('closed');
            }
            this.unbindListeners();
            this.socket = undefined;
        };
        TransportConnection.prototype.onMessage = function (message) {
            this.emit('message', message);
        };
        TransportConnection.prototype.onActivity = function () {
            this.emit('activity');
        };
        TransportConnection.prototype.bindListeners = function () {
            var _this = this;
            this.socket.onopen = function () {
                _this.onOpen();
            };
            this.socket.onerror = function (error) {
                _this.onError(error);
            };
            this.socket.onclose = function (closeEvent) {
                _this.onClose(closeEvent);
            };
            this.socket.onmessage = function (message) {
                _this.onMessage(message);
            };
            if (this.supportsPing()) {
                this.socket.onactivity = function () {
                    _this.onActivity();
                };
            }
        };
        TransportConnection.prototype.unbindListeners = function () {
            if (this.socket) {
                this.socket.onopen = undefined;
                this.socket.onerror = undefined;
                this.socket.onclose = undefined;
                this.socket.onmessage = undefined;
                if (this.supportsPing()) {
                    this.socket.onactivity = undefined;
                }
            }
        };
        TransportConnection.prototype.changeState = function (state, params) {
            this.state = state;
            this.timeline.info(this.buildTimelineMessage({
                state: state,
                params: params
            }));
            this.emit(state, params);
        };
        TransportConnection.prototype.buildTimelineMessage = function (message) {
            return extend({ cid: this.id }, message);
        };
        return TransportConnection;
    }(dispatcher));
    /* harmony default export */ var transport_connection = (transport_connection_TransportConnection);

    // CONCATENATED MODULE: ./src/core/transports/transport.ts

    var transport_Transport = (function () {
        function Transport(hooks) {
            this.hooks = hooks;
        }
        Transport.prototype.isSupported = function (environment) {
            return this.hooks.isSupported(environment);
        };
        Transport.prototype.createConnection = function (name, priority, key, options) {
            return new transport_connection(this.hooks, name, priority, key, options);
        };
        return Transport;
    }());
    /* harmony default export */ var transports_transport = (transport_Transport);

    // CONCATENATED MODULE: ./src/runtimes/isomorphic/transports/transports.ts




    var WSTransport = new transports_transport({
        urls: ws,
        handlesActivityChecks: false,
        supportsPing: false,
        isInitialized: function () {
            return Boolean(runtime.getWebSocketAPI());
        },
        isSupported: function () {
            return Boolean(runtime.getWebSocketAPI());
        },
        getSocket: function (url) {
            return runtime.createWebSocket(url);
        }
    });
    var httpConfiguration = {
        urls: http,
        handlesActivityChecks: false,
        supportsPing: true,
        isInitialized: function () {
            return true;
        }
    };
    var streamingConfiguration = extend({
        getSocket: function (url) {
            return runtime.HTTPFactory.createStreamingSocket(url);
        }
    }, httpConfiguration);
    var pollingConfiguration = extend({
        getSocket: function (url) {
            return runtime.HTTPFactory.createPollingSocket(url);
        }
    }, httpConfiguration);
    var xhrConfiguration = {
        isSupported: function () {
            return runtime.isXHRSupported();
        }
    };
    var XHRStreamingTransport = new transports_transport((extend({}, streamingConfiguration, xhrConfiguration)));
    var XHRPollingTransport = new transports_transport(extend({}, pollingConfiguration, xhrConfiguration));
    var Transports = {
        ws: WSTransport,
        xhr_streaming: XHRStreamingTransport,
        xhr_polling: XHRPollingTransport
    };
    /* harmony default export */ var transports = (Transports);

    // CONCATENATED MODULE: ./src/runtimes/web/transports/transports.ts






    var SockJSTransport = new transports_transport({
        file: 'sockjs',
        urls: sockjs,
        handlesActivityChecks: true,
        supportsPing: false,
        isSupported: function () {
            return true;
        },
        isInitialized: function () {
            return window.SockJS !== undefined;
        },
        getSocket: function (url, options) {
            return new window.SockJS(url, null, {
                js_path: Dependencies.getPath('sockjs', {
                    useTLS: options.useTLS
                }),
                ignore_null_origin: options.ignoreNullOrigin
            });
        },
        beforeOpen: function (socket, path) {
            socket.send(JSON.stringify({
                path: path
            }));
        }
    });
    var xdrConfiguration = {
        isSupported: function (environment) {
            var yes = runtime.isXDRSupported(environment.useTLS);
            return yes;
        }
    };
    var XDRStreamingTransport = new transports_transport((extend({}, streamingConfiguration, xdrConfiguration)));
    var XDRPollingTransport = new transports_transport(extend({}, pollingConfiguration, xdrConfiguration));
    transports.xdr_streaming = XDRStreamingTransport;
    transports.xdr_polling = XDRPollingTransport;
    transports.sockjs = SockJSTransport;
    /* harmony default export */ var transports_transports = (transports);

    // CONCATENATED MODULE: ./src/runtimes/web/net_info.ts
    var net_info_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();

    var NetInfo = (function (_super) {
        net_info_extends(NetInfo, _super);
        function NetInfo() {
            var _this = _super.call(this) || this;
            var self = _this;
            if (window.addEventListener !== undefined) {
                window.addEventListener('online', function () {
                    self.emit('online');
                }, false);
                window.addEventListener('offline', function () {
                    self.emit('offline');
                }, false);
            }
            return _this;
        }
        NetInfo.prototype.isOnline = function () {
            if (window.navigator.onLine === undefined) {
                return true;
            }
            else {
                return window.navigator.onLine;
            }
        };
        return NetInfo;
    }(dispatcher));

    var net_info_Network = new NetInfo();

    // CONCATENATED MODULE: ./src/core/transports/assistant_to_the_transport_manager.ts


    var assistant_to_the_transport_manager_AssistantToTheTransportManager = (function () {
        function AssistantToTheTransportManager(manager, transport, options) {
            this.manager = manager;
            this.transport = transport;
            this.minPingDelay = options.minPingDelay;
            this.maxPingDelay = options.maxPingDelay;
            this.pingDelay = undefined;
        }
        AssistantToTheTransportManager.prototype.createConnection = function (name, priority, key, options) {
            var _this = this;
            options = extend({}, options, {
                activityTimeout: this.pingDelay
            });
            var connection = this.transport.createConnection(name, priority, key, options);
            var openTimestamp = null;
            var onOpen = function () {
                connection.unbind('open', onOpen);
                connection.bind('closed', onClosed);
                openTimestamp = util.now();
            };
            var onClosed = function (closeEvent) {
                connection.unbind('closed', onClosed);
                if (closeEvent.code === 1002 || closeEvent.code === 1003) {
                    _this.manager.reportDeath();
                }
                else if (!closeEvent.wasClean && openTimestamp) {
                    var lifespan = util.now() - openTimestamp;
                    if (lifespan < 2 * _this.maxPingDelay) {
                        _this.manager.reportDeath();
                        _this.pingDelay = Math.max(lifespan / 2, _this.minPingDelay);
                    }
                }
            };
            connection.bind('open', onOpen);
            return connection;
        };
        AssistantToTheTransportManager.prototype.isSupported = function (environment) {
            return this.manager.isAlive() && this.transport.isSupported(environment);
        };
        return AssistantToTheTransportManager;
    }());
    /* harmony default export */ var assistant_to_the_transport_manager = (assistant_to_the_transport_manager_AssistantToTheTransportManager);

    // CONCATENATED MODULE: ./src/core/connection/protocol/protocol.ts
    var Protocol = {
        decodeMessage: function (messageEvent) {
            try {
                var messageData = JSON.parse(messageEvent.data);
                var pusherEventData = messageData.data;
                if (typeof pusherEventData === 'string') {
                    try {
                        pusherEventData = JSON.parse(messageData.data);
                    }
                    catch (e) { }
                }
                var pusherEvent = {
                    event: messageData.event,
                    channel: messageData.channel,
                    data: pusherEventData
                };
                if (messageData.user_id) {
                    pusherEvent.user_id = messageData.user_id;
                }
                return pusherEvent;
            }
            catch (e) {
                throw { type: 'MessageParseError', error: e, data: messageEvent.data };
            }
        },
        encodeMessage: function (event) {
            return JSON.stringify(event);
        },
        processHandshake: function (messageEvent) {
            var message = Protocol.decodeMessage(messageEvent);
            if (message.event === 'pusher:connection_established') {
                if (!message.data.activity_timeout) {
                    throw 'No activity timeout specified in handshake';
                }
                return {
                    action: 'connected',
                    id: message.data.socket_id,
                    activityTimeout: message.data.activity_timeout * 1000
                };
            }
            else if (message.event === 'pusher:error') {
                return {
                    action: this.getCloseAction(message.data),
                    error: this.getCloseError(message.data)
                };
            }
            else {
                throw 'Invalid handshake';
            }
        },
        getCloseAction: function (closeEvent) {
            if (closeEvent.code < 4000) {
                if (closeEvent.code >= 1002 && closeEvent.code <= 1004) {
                    return 'backoff';
                }
                else {
                    return null;
                }
            }
            else if (closeEvent.code === 4000) {
                return 'tls_only';
            }
            else if (closeEvent.code < 4100) {
                return 'refused';
            }
            else if (closeEvent.code < 4200) {
                return 'backoff';
            }
            else if (closeEvent.code < 4300) {
                return 'retry';
            }
            else {
                return 'refused';
            }
        },
        getCloseError: function (closeEvent) {
            if (closeEvent.code !== 1000 && closeEvent.code !== 1001) {
                return {
                    type: 'PusherError',
                    data: {
                        code: closeEvent.code,
                        message: closeEvent.reason || closeEvent.message
                    }
                };
            }
            else {
                return null;
            }
        }
    };
    /* harmony default export */ var protocol_protocol = (Protocol);

    // CONCATENATED MODULE: ./src/core/connection/connection.ts
    var connection_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();




    var connection_Connection = (function (_super) {
        connection_extends(Connection, _super);
        function Connection(id, transport) {
            var _this = _super.call(this) || this;
            _this.id = id;
            _this.transport = transport;
            _this.activityTimeout = transport.activityTimeout;
            _this.bindListeners();
            return _this;
        }
        Connection.prototype.handlesActivityChecks = function () {
            return this.transport.handlesActivityChecks();
        };
        Connection.prototype.send = function (data) {
            return this.transport.send(data);
        };
        Connection.prototype.send_event = function (name, data, channel) {
            var event = { event: name, data: data };
            if (channel) {
                event.channel = channel;
            }
            logger.debug('Event sent', event);
            return this.send(protocol_protocol.encodeMessage(event));
        };
        Connection.prototype.ping = function () {
            if (this.transport.supportsPing()) {
                this.transport.ping();
            }
            else {
                this.send_event('pusher:ping', {});
            }
        };
        Connection.prototype.close = function () {
            this.transport.close();
        };
        Connection.prototype.bindListeners = function () {
            var _this = this;
            var listeners = {
                message: function (messageEvent) {
                    var pusherEvent;
                    try {
                        pusherEvent = protocol_protocol.decodeMessage(messageEvent);
                    }
                    catch (e) {
                        _this.emit('error', {
                            type: 'MessageParseError',
                            error: e,
                            data: messageEvent.data
                        });
                    }
                    if (pusherEvent !== undefined) {
                        logger.debug('Event recd', pusherEvent);
                        switch (pusherEvent.event) {
                            case 'pusher:error':
                                _this.emit('error', {
                                    type: 'PusherError',
                                    data: pusherEvent.data
                                });
                                break;
                            case 'pusher:ping':
                                _this.emit('ping');
                                break;
                            case 'pusher:pong':
                                _this.emit('pong');
                                break;
                        }
                        _this.emit('message', pusherEvent);
                    }
                },
                activity: function () {
                    _this.emit('activity');
                },
                error: function (error) {
                    _this.emit('error', error);
                },
                closed: function (closeEvent) {
                    unbindListeners();
                    if (closeEvent && closeEvent.code) {
                        _this.handleCloseEvent(closeEvent);
                    }
                    _this.transport = null;
                    _this.emit('closed');
                }
            };
            var unbindListeners = function () {
                objectApply(listeners, function (listener, event) {
                    _this.transport.unbind(event, listener);
                });
            };
            objectApply(listeners, function (listener, event) {
                _this.transport.bind(event, listener);
            });
        };
        Connection.prototype.handleCloseEvent = function (closeEvent) {
            var action = protocol_protocol.getCloseAction(closeEvent);
            var error = protocol_protocol.getCloseError(closeEvent);
            if (error) {
                this.emit('error', error);
            }
            if (action) {
                this.emit(action, { action: action, error: error });
            }
        };
        return Connection;
    }(dispatcher));
    /* harmony default export */ var connection_connection = (connection_Connection);

    // CONCATENATED MODULE: ./src/core/connection/handshake/index.ts



    var handshake_Handshake = (function () {
        function Handshake(transport, callback) {
            this.transport = transport;
            this.callback = callback;
            this.bindListeners();
        }
        Handshake.prototype.close = function () {
            this.unbindListeners();
            this.transport.close();
        };
        Handshake.prototype.bindListeners = function () {
            var _this = this;
            this.onMessage = function (m) {
                _this.unbindListeners();
                var result;
                try {
                    result = protocol_protocol.processHandshake(m);
                }
                catch (e) {
                    _this.finish('error', { error: e });
                    _this.transport.close();
                    return;
                }
                if (result.action === 'connected') {
                    _this.finish('connected', {
                        connection: new connection_connection(result.id, _this.transport),
                        activityTimeout: result.activityTimeout
                    });
                }
                else {
                    _this.finish(result.action, { error: result.error });
                    _this.transport.close();
                }
            };
            this.onClosed = function (closeEvent) {
                _this.unbindListeners();
                var action = protocol_protocol.getCloseAction(closeEvent) || 'backoff';
                var error = protocol_protocol.getCloseError(closeEvent);
                _this.finish(action, { error: error });
            };
            this.transport.bind('message', this.onMessage);
            this.transport.bind('closed', this.onClosed);
        };
        Handshake.prototype.unbindListeners = function () {
            this.transport.unbind('message', this.onMessage);
            this.transport.unbind('closed', this.onClosed);
        };
        Handshake.prototype.finish = function (action, params) {
            this.callback(extend({ transport: this.transport, action: action }, params));
        };
        return Handshake;
    }());
    /* harmony default export */ var connection_handshake = (handshake_Handshake);

    // CONCATENATED MODULE: ./src/core/auth/pusher_authorizer.ts

    var pusher_authorizer_PusherAuthorizer = (function () {
        function PusherAuthorizer(channel, options) {
            this.channel = channel;
            var authTransport = options.authTransport;
            if (typeof runtime.getAuthorizers()[authTransport] === 'undefined') {
                throw "'" + authTransport + "' is not a recognized auth transport";
            }
            this.type = authTransport;
            this.options = options;
            this.authOptions = options.auth || {};
        }
        PusherAuthorizer.prototype.composeQuery = function (socketId) {
            var query = 'socket_id=' +
                encodeURIComponent(socketId) +
                '&channel_name=' +
                encodeURIComponent(this.channel.name);
            for (var i in this.authOptions.params) {
                query +=
                    '&' +
                        encodeURIComponent(i) +
                        '=' +
                        encodeURIComponent(this.authOptions.params[i]);
            }
            return query;
        };
        PusherAuthorizer.prototype.authorize = function (socketId, callback) {
            PusherAuthorizer.authorizers =
                PusherAuthorizer.authorizers || runtime.getAuthorizers();
            PusherAuthorizer.authorizers[this.type].call(this, runtime, socketId, callback);
        };
        return PusherAuthorizer;
    }());
    /* harmony default export */ var pusher_authorizer = (pusher_authorizer_PusherAuthorizer);

    // CONCATENATED MODULE: ./src/core/timeline/timeline_sender.ts

    var timeline_sender_TimelineSender = (function () {
        function TimelineSender(timeline, options) {
            this.timeline = timeline;
            this.options = options || {};
        }
        TimelineSender.prototype.send = function (useTLS, callback) {
            if (this.timeline.isEmpty()) {
                return;
            }
            this.timeline.send(runtime.TimelineTransport.getAgent(this, useTLS), callback);
        };
        return TimelineSender;
    }());
    /* harmony default export */ var timeline_sender = (timeline_sender_TimelineSender);

    // CONCATENATED MODULE: ./src/core/channels/channel.ts
    var channel_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();





    var channel_Channel = (function (_super) {
        channel_extends(Channel, _super);
        function Channel(name, pusher) {
            var _this = _super.call(this, function (event, data) {
                logger.debug('No callbacks on ' + name + ' for ' + event);
            }) || this;
            _this.name = name;
            _this.pusher = pusher;
            _this.subscribed = false;
            _this.subscriptionPending = false;
            _this.subscriptionCancelled = false;
            return _this;
        }
        Channel.prototype.authorize = function (socketId, callback) {
            return callback(null, { auth: '' });
        };
        Channel.prototype.trigger = function (event, data) {
            if (event.indexOf('client-') !== 0) {
                throw new BadEventName("Event '" + event + "' does not start with 'client-'");
            }
            if (!this.subscribed) {
                var suffix = url_store.buildLogSuffix('triggeringClientEvents');
                logger.warn("Client event triggered before channel 'subscription_succeeded' event . " + suffix);
            }
            return this.pusher.send_event(event, data, this.name);
        };
        Channel.prototype.disconnect = function () {
            this.subscribed = false;
            this.subscriptionPending = false;
        };
        Channel.prototype.handleEvent = function (event) {
            var eventName = event.event;
            var data = event.data;
            if (eventName === 'pusher_internal:subscription_succeeded') {
                this.handleSubscriptionSucceededEvent(event);
            }
            else if (eventName.indexOf('pusher_internal:') !== 0) {
                var metadata = {};
                this.emit(eventName, data, metadata);
            }
        };
        Channel.prototype.handleSubscriptionSucceededEvent = function (event) {
            this.subscriptionPending = false;
            this.subscribed = true;
            if (this.subscriptionCancelled) {
                this.pusher.unsubscribe(this.name);
            }
            else {
                this.emit('pusher:subscription_succeeded', event.data);
            }
        };
        Channel.prototype.subscribe = function () {
            var _this = this;
            if (this.subscribed) {
                return;
            }
            this.subscriptionPending = true;
            this.subscriptionCancelled = false;
            this.authorize(this.pusher.connection.socket_id, function (error, data) {
                if (error) {
                    _this.subscriptionPending = false;
                    logger.error(error.toString());
                    _this.emit('pusher:subscription_error', Object.assign({}, {
                        type: 'AuthError',
                        error: error.message
                    }, error instanceof HTTPAuthError ? { status: error.status } : {}));
                }
                else {
                    _this.pusher.send_event('pusher:subscribe', {
                        auth: data.auth,
                        channel_data: data.channel_data,
                        channel: _this.name
                    });
                }
            });
        };
        Channel.prototype.unsubscribe = function () {
            this.subscribed = false;
            this.pusher.send_event('pusher:unsubscribe', {
                channel: this.name
            });
        };
        Channel.prototype.cancelSubscription = function () {
            this.subscriptionCancelled = true;
        };
        Channel.prototype.reinstateSubscription = function () {
            this.subscriptionCancelled = false;
        };
        return Channel;
    }(dispatcher));
    /* harmony default export */ var channels_channel = (channel_Channel);

    // CONCATENATED MODULE: ./src/core/channels/private_channel.ts
    var private_channel_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();


    var private_channel_PrivateChannel = (function (_super) {
        private_channel_extends(PrivateChannel, _super);
        function PrivateChannel() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        PrivateChannel.prototype.authorize = function (socketId, callback) {
            var authorizer = factory.createAuthorizer(this, this.pusher.config);
            return authorizer.authorize(socketId, callback);
        };
        return PrivateChannel;
    }(channels_channel));
    /* harmony default export */ var private_channel = (private_channel_PrivateChannel);

    // CONCATENATED MODULE: ./src/core/channels/members.ts

    var members_Members = (function () {
        function Members() {
            this.reset();
        }
        Members.prototype.get = function (id) {
            if (Object.prototype.hasOwnProperty.call(this.members, id)) {
                return {
                    id: id,
                    info: this.members[id]
                };
            }
            else {
                return null;
            }
        };
        Members.prototype.each = function (callback) {
            var _this = this;
            objectApply(this.members, function (member, id) {
                callback(_this.get(id));
            });
        };
        Members.prototype.setMyID = function (id) {
            this.myID = id;
        };
        Members.prototype.onSubscription = function (subscriptionData) {
            this.members = subscriptionData.presence.hash;
            this.count = subscriptionData.presence.count;
            this.me = this.get(this.myID);
        };
        Members.prototype.addMember = function (memberData) {
            if (this.get(memberData.user_id) === null) {
                this.count++;
            }
            this.members[memberData.user_id] = memberData.user_info;
            return this.get(memberData.user_id);
        };
        Members.prototype.removeMember = function (memberData) {
            var member = this.get(memberData.user_id);
            if (member) {
                delete this.members[memberData.user_id];
                this.count--;
            }
            return member;
        };
        Members.prototype.reset = function () {
            this.members = {};
            this.count = 0;
            this.myID = null;
            this.me = null;
        };
        return Members;
    }());
    /* harmony default export */ var members = (members_Members);

    // CONCATENATED MODULE: ./src/core/channels/presence_channel.ts
    var presence_channel_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();




    var presence_channel_PresenceChannel = (function (_super) {
        presence_channel_extends(PresenceChannel, _super);
        function PresenceChannel(name, pusher) {
            var _this = _super.call(this, name, pusher) || this;
            _this.members = new members();
            return _this;
        }
        PresenceChannel.prototype.authorize = function (socketId, callback) {
            var _this = this;
            _super.prototype.authorize.call(this, socketId, function (error, authData) {
                if (!error) {
                    authData = authData;
                    if (authData.channel_data === undefined) {
                        var suffix = url_store.buildLogSuffix('authenticationEndpoint');
                        logger.error("Invalid auth response for channel '" + _this.name + "'," +
                            ("expected 'channel_data' field. " + suffix));
                        callback('Invalid auth response');
                        return;
                    }
                    var channelData = JSON.parse(authData.channel_data);
                    _this.members.setMyID(channelData.user_id);
                }
                callback(error, authData);
            });
        };
        PresenceChannel.prototype.handleEvent = function (event) {
            var eventName = event.event;
            if (eventName.indexOf('pusher_internal:') === 0) {
                this.handleInternalEvent(event);
            }
            else {
                var data = event.data;
                var metadata = {};
                if (event.user_id) {
                    metadata.user_id = event.user_id;
                }
                this.emit(eventName, data, metadata);
            }
        };
        PresenceChannel.prototype.handleInternalEvent = function (event) {
            var eventName = event.event;
            var data = event.data;
            switch (eventName) {
                case 'pusher_internal:subscription_succeeded':
                    this.handleSubscriptionSucceededEvent(event);
                    break;
                case 'pusher_internal:member_added':
                    var addedMember = this.members.addMember(data);
                    this.emit('pusher:member_added', addedMember);
                    break;
                case 'pusher_internal:member_removed':
                    var removedMember = this.members.removeMember(data);
                    if (removedMember) {
                        this.emit('pusher:member_removed', removedMember);
                    }
                    break;
            }
        };
        PresenceChannel.prototype.handleSubscriptionSucceededEvent = function (event) {
            this.subscriptionPending = false;
            this.subscribed = true;
            if (this.subscriptionCancelled) {
                this.pusher.unsubscribe(this.name);
            }
            else {
                this.members.onSubscription(event.data);
                this.emit('pusher:subscription_succeeded', this.members);
            }
        };
        PresenceChannel.prototype.disconnect = function () {
            this.members.reset();
            _super.prototype.disconnect.call(this);
        };
        return PresenceChannel;
    }(private_channel));
    /* harmony default export */ var presence_channel = (presence_channel_PresenceChannel);

    // EXTERNAL MODULE: ./node_modules/@stablelib/utf8/lib/utf8.js
    var utf8 = __webpack_require__(1);

    // EXTERNAL MODULE: ./node_modules/@stablelib/base64/lib/base64.js
    var base64 = __webpack_require__(0);

    // CONCATENATED MODULE: ./src/core/channels/encrypted_channel.ts
    var encrypted_channel_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();





    var encrypted_channel_EncryptedChannel = (function (_super) {
        encrypted_channel_extends(EncryptedChannel, _super);
        function EncryptedChannel(name, pusher, nacl) {
            var _this = _super.call(this, name, pusher) || this;
            _this.key = null;
            _this.nacl = nacl;
            return _this;
        }
        EncryptedChannel.prototype.authorize = function (socketId, callback) {
            var _this = this;
            _super.prototype.authorize.call(this, socketId, function (error, authData) {
                if (error) {
                    callback(error, authData);
                    return;
                }
                var sharedSecret = authData['shared_secret'];
                if (!sharedSecret) {
                    callback(new Error("No shared_secret key in auth payload for encrypted channel: " + _this.name), null);
                    return;
                }
                _this.key = Object(base64["decode"])(sharedSecret);
                delete authData['shared_secret'];
                callback(null, authData);
            });
        };
        EncryptedChannel.prototype.trigger = function (event, data) {
            throw new UnsupportedFeature('Client events are not currently supported for encrypted channels');
        };
        EncryptedChannel.prototype.handleEvent = function (event) {
            var eventName = event.event;
            var data = event.data;
            if (eventName.indexOf('pusher_internal:') === 0 ||
                eventName.indexOf('pusher:') === 0) {
                _super.prototype.handleEvent.call(this, event);
                return;
            }
            this.handleEncryptedEvent(eventName, data);
        };
        EncryptedChannel.prototype.handleEncryptedEvent = function (event, data) {
            var _this = this;
            if (!this.key) {
                logger.debug('Received encrypted event before key has been retrieved from the authEndpoint');
                return;
            }
            if (!data.ciphertext || !data.nonce) {
                logger.error('Unexpected format for encrypted event, expected object with `ciphertext` and `nonce` fields, got: ' +
                    data);
                return;
            }
            var cipherText = Object(base64["decode"])(data.ciphertext);
            if (cipherText.length < this.nacl.secretbox.overheadLength) {
                logger.error("Expected encrypted event ciphertext length to be " + this.nacl.secretbox.overheadLength + ", got: " + cipherText.length);
                return;
            }
            var nonce = Object(base64["decode"])(data.nonce);
            if (nonce.length < this.nacl.secretbox.nonceLength) {
                logger.error("Expected encrypted event nonce length to be " + this.nacl.secretbox.nonceLength + ", got: " + nonce.length);
                return;
            }
            var bytes = this.nacl.secretbox.open(cipherText, nonce, this.key);
            if (bytes === null) {
                logger.debug('Failed to decrypt an event, probably because it was encrypted with a different key. Fetching a new key from the authEndpoint...');
                this.authorize(this.pusher.connection.socket_id, function (error, authData) {
                    if (error) {
                        logger.error("Failed to make a request to the authEndpoint: " + authData + ". Unable to fetch new key, so dropping encrypted event");
                        return;
                    }
                    bytes = _this.nacl.secretbox.open(cipherText, nonce, _this.key);
                    if (bytes === null) {
                        logger.error("Failed to decrypt event with new key. Dropping encrypted event");
                        return;
                    }
                    _this.emit(event, _this.getDataToEmit(bytes));
                    return;
                });
                return;
            }
            this.emit(event, this.getDataToEmit(bytes));
        };
        EncryptedChannel.prototype.getDataToEmit = function (bytes) {
            var raw = Object(utf8["decode"])(bytes);
            try {
                return JSON.parse(raw);
            }
            catch (_a) {
                return raw;
            }
        };
        return EncryptedChannel;
    }(private_channel));
    /* harmony default export */ var encrypted_channel = (encrypted_channel_EncryptedChannel);

    // CONCATENATED MODULE: ./src/core/connection/connection_manager.ts
    var connection_manager_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();





    var connection_manager_ConnectionManager = (function (_super) {
        connection_manager_extends(ConnectionManager, _super);
        function ConnectionManager(key, options) {
            var _this = _super.call(this) || this;
            _this.state = 'initialized';
            _this.connection = null;
            _this.key = key;
            _this.options = options;
            _this.timeline = _this.options.timeline;
            _this.usingTLS = _this.options.useTLS;
            _this.errorCallbacks = _this.buildErrorCallbacks();
            _this.connectionCallbacks = _this.buildConnectionCallbacks(_this.errorCallbacks);
            _this.handshakeCallbacks = _this.buildHandshakeCallbacks(_this.errorCallbacks);
            var Network = runtime.getNetwork();
            Network.bind('online', function () {
                _this.timeline.info({ netinfo: 'online' });
                if (_this.state === 'connecting' || _this.state === 'unavailable') {
                    _this.retryIn(0);
                }
            });
            Network.bind('offline', function () {
                _this.timeline.info({ netinfo: 'offline' });
                if (_this.connection) {
                    _this.sendActivityCheck();
                }
            });
            _this.updateStrategy();
            return _this;
        }
        ConnectionManager.prototype.connect = function () {
            if (this.connection || this.runner) {
                return;
            }
            if (!this.strategy.isSupported()) {
                this.updateState('failed');
                return;
            }
            this.updateState('connecting');
            this.startConnecting();
            this.setUnavailableTimer();
        };
        ConnectionManager.prototype.send = function (data) {
            if (this.connection) {
                return this.connection.send(data);
            }
            else {
                return false;
            }
        };
        ConnectionManager.prototype.send_event = function (name, data, channel) {
            if (this.connection) {
                return this.connection.send_event(name, data, channel);
            }
            else {
                return false;
            }
        };
        ConnectionManager.prototype.disconnect = function () {
            this.disconnectInternally();
            this.updateState('disconnected');
        };
        ConnectionManager.prototype.isUsingTLS = function () {
            return this.usingTLS;
        };
        ConnectionManager.prototype.startConnecting = function () {
            var _this = this;
            var callback = function (error, handshake) {
                if (error) {
                    _this.runner = _this.strategy.connect(0, callback);
                }
                else {
                    if (handshake.action === 'error') {
                        _this.emit('error', {
                            type: 'HandshakeError',
                            error: handshake.error
                        });
                        _this.timeline.error({ handshakeError: handshake.error });
                    }
                    else {
                        _this.abortConnecting();
                        _this.handshakeCallbacks[handshake.action](handshake);
                    }
                }
            };
            this.runner = this.strategy.connect(0, callback);
        };
        ConnectionManager.prototype.abortConnecting = function () {
            if (this.runner) {
                this.runner.abort();
                this.runner = null;
            }
        };
        ConnectionManager.prototype.disconnectInternally = function () {
            this.abortConnecting();
            this.clearRetryTimer();
            this.clearUnavailableTimer();
            if (this.connection) {
                var connection = this.abandonConnection();
                connection.close();
            }
        };
        ConnectionManager.prototype.updateStrategy = function () {
            this.strategy = this.options.getStrategy({
                key: this.key,
                timeline: this.timeline,
                useTLS: this.usingTLS
            });
        };
        ConnectionManager.prototype.retryIn = function (delay) {
            var _this = this;
            this.timeline.info({ action: 'retry', delay: delay });
            if (delay > 0) {
                this.emit('connecting_in', Math.round(delay / 1000));
            }
            this.retryTimer = new OneOffTimer(delay || 0, function () {
                _this.disconnectInternally();
                _this.connect();
            });
        };
        ConnectionManager.prototype.clearRetryTimer = function () {
            if (this.retryTimer) {
                this.retryTimer.ensureAborted();
                this.retryTimer = null;
            }
        };
        ConnectionManager.prototype.setUnavailableTimer = function () {
            var _this = this;
            this.unavailableTimer = new OneOffTimer(this.options.unavailableTimeout, function () {
                _this.updateState('unavailable');
            });
        };
        ConnectionManager.prototype.clearUnavailableTimer = function () {
            if (this.unavailableTimer) {
                this.unavailableTimer.ensureAborted();
            }
        };
        ConnectionManager.prototype.sendActivityCheck = function () {
            var _this = this;
            this.stopActivityCheck();
            this.connection.ping();
            this.activityTimer = new OneOffTimer(this.options.pongTimeout, function () {
                _this.timeline.error({ pong_timed_out: _this.options.pongTimeout });
                _this.retryIn(0);
            });
        };
        ConnectionManager.prototype.resetActivityCheck = function () {
            var _this = this;
            this.stopActivityCheck();
            if (this.connection && !this.connection.handlesActivityChecks()) {
                this.activityTimer = new OneOffTimer(this.activityTimeout, function () {
                    _this.sendActivityCheck();
                });
            }
        };
        ConnectionManager.prototype.stopActivityCheck = function () {
            if (this.activityTimer) {
                this.activityTimer.ensureAborted();
            }
        };
        ConnectionManager.prototype.buildConnectionCallbacks = function (errorCallbacks) {
            var _this = this;
            return extend({}, errorCallbacks, {
                message: function (message) {
                    _this.resetActivityCheck();
                    _this.emit('message', message);
                },
                ping: function () {
                    _this.send_event('pusher:pong', {});
                },
                activity: function () {
                    _this.resetActivityCheck();
                },
                error: function (error) {
                    _this.emit('error', error);
                },
                closed: function () {
                    _this.abandonConnection();
                    if (_this.shouldRetry()) {
                        _this.retryIn(1000);
                    }
                }
            });
        };
        ConnectionManager.prototype.buildHandshakeCallbacks = function (errorCallbacks) {
            var _this = this;
            return extend({}, errorCallbacks, {
                connected: function (handshake) {
                    _this.activityTimeout = Math.min(_this.options.activityTimeout, handshake.activityTimeout, handshake.connection.activityTimeout || Infinity);
                    _this.clearUnavailableTimer();
                    _this.setConnection(handshake.connection);
                    _this.socket_id = _this.connection.id;
                    _this.updateState('connected', { socket_id: _this.socket_id });
                }
            });
        };
        ConnectionManager.prototype.buildErrorCallbacks = function () {
            var _this = this;
            var withErrorEmitted = function (callback) {
                return function (result) {
                    if (result.error) {
                        _this.emit('error', { type: 'WebSocketError', error: result.error });
                    }
                    callback(result);
                };
            };
            return {
                tls_only: withErrorEmitted(function () {
                    _this.usingTLS = true;
                    _this.updateStrategy();
                    _this.retryIn(0);
                }),
                refused: withErrorEmitted(function () {
                    _this.disconnect();
                }),
                backoff: withErrorEmitted(function () {
                    _this.retryIn(1000);
                }),
                retry: withErrorEmitted(function () {
                    _this.retryIn(0);
                })
            };
        };
        ConnectionManager.prototype.setConnection = function (connection) {
            this.connection = connection;
            for (var event in this.connectionCallbacks) {
                this.connection.bind(event, this.connectionCallbacks[event]);
            }
            this.resetActivityCheck();
        };
        ConnectionManager.prototype.abandonConnection = function () {
            if (!this.connection) {
                return;
            }
            this.stopActivityCheck();
            for (var event in this.connectionCallbacks) {
                this.connection.unbind(event, this.connectionCallbacks[event]);
            }
            var connection = this.connection;
            this.connection = null;
            return connection;
        };
        ConnectionManager.prototype.updateState = function (newState, data) {
            var previousState = this.state;
            this.state = newState;
            if (previousState !== newState) {
                var newStateDescription = newState;
                if (newStateDescription === 'connected') {
                    newStateDescription += ' with new socket ID ' + data.socket_id;
                }
                logger.debug('State changed', previousState + ' -> ' + newStateDescription);
                this.timeline.info({ state: newState, params: data });
                this.emit('state_change', { previous: previousState, current: newState });
                this.emit(newState, data);
            }
        };
        ConnectionManager.prototype.shouldRetry = function () {
            return this.state === 'connecting' || this.state === 'connected';
        };
        return ConnectionManager;
    }(dispatcher));
    /* harmony default export */ var connection_manager = (connection_manager_ConnectionManager);

    // CONCATENATED MODULE: ./src/core/channels/channels.ts




    var channels_Channels = (function () {
        function Channels() {
            this.channels = {};
        }
        Channels.prototype.add = function (name, pusher) {
            if (!this.channels[name]) {
                this.channels[name] = createChannel(name, pusher);
            }
            return this.channels[name];
        };
        Channels.prototype.all = function () {
            return values(this.channels);
        };
        Channels.prototype.find = function (name) {
            return this.channels[name];
        };
        Channels.prototype.remove = function (name) {
            var channel = this.channels[name];
            delete this.channels[name];
            return channel;
        };
        Channels.prototype.disconnect = function () {
            objectApply(this.channels, function (channel) {
                channel.disconnect();
            });
        };
        return Channels;
    }());
    /* harmony default export */ var channels = (channels_Channels);
    function createChannel(name, pusher) {
        if (name.indexOf('private-encrypted-') === 0) {
            if (pusher.config.nacl) {
                return factory.createEncryptedChannel(name, pusher, pusher.config.nacl);
            }
            var errMsg = 'Tried to subscribe to a private-encrypted- channel but no nacl implementation available';
            var suffix = url_store.buildLogSuffix('encryptedChannelSupport');
            throw new UnsupportedFeature(errMsg + ". " + suffix);
        }
        else if (name.indexOf('private-') === 0) {
            return factory.createPrivateChannel(name, pusher);
        }
        else if (name.indexOf('presence-') === 0) {
            return factory.createPresenceChannel(name, pusher);
        }
        else {
            return factory.createChannel(name, pusher);
        }
    }

    // CONCATENATED MODULE: ./src/core/utils/factory.ts










    var Factory = {
        createChannels: function () {
            return new channels();
        },
        createConnectionManager: function (key, options) {
            return new connection_manager(key, options);
        },
        createChannel: function (name, pusher) {
            return new channels_channel(name, pusher);
        },
        createPrivateChannel: function (name, pusher) {
            return new private_channel(name, pusher);
        },
        createPresenceChannel: function (name, pusher) {
            return new presence_channel(name, pusher);
        },
        createEncryptedChannel: function (name, pusher, nacl) {
            return new encrypted_channel(name, pusher, nacl);
        },
        createTimelineSender: function (timeline, options) {
            return new timeline_sender(timeline, options);
        },
        createAuthorizer: function (channel, options) {
            if (options.authorizer) {
                return options.authorizer(channel, options);
            }
            return new pusher_authorizer(channel, options);
        },
        createHandshake: function (transport, callback) {
            return new connection_handshake(transport, callback);
        },
        createAssistantToTheTransportManager: function (manager, transport, options) {
            return new assistant_to_the_transport_manager(manager, transport, options);
        }
    };
    /* harmony default export */ var factory = (Factory);

    // CONCATENATED MODULE: ./src/core/transports/transport_manager.ts

    var transport_manager_TransportManager = (function () {
        function TransportManager(options) {
            this.options = options || {};
            this.livesLeft = this.options.lives || Infinity;
        }
        TransportManager.prototype.getAssistant = function (transport) {
            return factory.createAssistantToTheTransportManager(this, transport, {
                minPingDelay: this.options.minPingDelay,
                maxPingDelay: this.options.maxPingDelay
            });
        };
        TransportManager.prototype.isAlive = function () {
            return this.livesLeft > 0;
        };
        TransportManager.prototype.reportDeath = function () {
            this.livesLeft -= 1;
        };
        return TransportManager;
    }());
    /* harmony default export */ var transport_manager = (transport_manager_TransportManager);

    // CONCATENATED MODULE: ./src/core/strategies/sequential_strategy.ts



    var sequential_strategy_SequentialStrategy = (function () {
        function SequentialStrategy(strategies, options) {
            this.strategies = strategies;
            this.loop = Boolean(options.loop);
            this.failFast = Boolean(options.failFast);
            this.timeout = options.timeout;
            this.timeoutLimit = options.timeoutLimit;
        }
        SequentialStrategy.prototype.isSupported = function () {
            return any(this.strategies, util.method('isSupported'));
        };
        SequentialStrategy.prototype.connect = function (minPriority, callback) {
            var _this = this;
            var strategies = this.strategies;
            var current = 0;
            var timeout = this.timeout;
            var runner = null;
            var tryNextStrategy = function (error, handshake) {
                if (handshake) {
                    callback(null, handshake);
                }
                else {
                    current = current + 1;
                    if (_this.loop) {
                        current = current % strategies.length;
                    }
                    if (current < strategies.length) {
                        if (timeout) {
                            timeout = timeout * 2;
                            if (_this.timeoutLimit) {
                                timeout = Math.min(timeout, _this.timeoutLimit);
                            }
                        }
                        runner = _this.tryStrategy(strategies[current], minPriority, { timeout: timeout, failFast: _this.failFast }, tryNextStrategy);
                    }
                    else {
                        callback(true);
                    }
                }
            };
            runner = this.tryStrategy(strategies[current], minPriority, { timeout: timeout, failFast: this.failFast }, tryNextStrategy);
            return {
                abort: function () {
                    runner.abort();
                },
                forceMinPriority: function (p) {
                    minPriority = p;
                    if (runner) {
                        runner.forceMinPriority(p);
                    }
                }
            };
        };
        SequentialStrategy.prototype.tryStrategy = function (strategy, minPriority, options, callback) {
            var timer = null;
            var runner = null;
            if (options.timeout > 0) {
                timer = new OneOffTimer(options.timeout, function () {
                    runner.abort();
                    callback(true);
                });
            }
            runner = strategy.connect(minPriority, function (error, handshake) {
                if (error && timer && timer.isRunning() && !options.failFast) {
                    return;
                }
                if (timer) {
                    timer.ensureAborted();
                }
                callback(error, handshake);
            });
            return {
                abort: function () {
                    if (timer) {
                        timer.ensureAborted();
                    }
                    runner.abort();
                },
                forceMinPriority: function (p) {
                    runner.forceMinPriority(p);
                }
            };
        };
        return SequentialStrategy;
    }());
    /* harmony default export */ var sequential_strategy = (sequential_strategy_SequentialStrategy);

    // CONCATENATED MODULE: ./src/core/strategies/best_connected_ever_strategy.ts


    var best_connected_ever_strategy_BestConnectedEverStrategy = (function () {
        function BestConnectedEverStrategy(strategies) {
            this.strategies = strategies;
        }
        BestConnectedEverStrategy.prototype.isSupported = function () {
            return any(this.strategies, util.method('isSupported'));
        };
        BestConnectedEverStrategy.prototype.connect = function (minPriority, callback) {
            return connect(this.strategies, minPriority, function (i, runners) {
                return function (error, handshake) {
                    runners[i].error = error;
                    if (error) {
                        if (allRunnersFailed(runners)) {
                            callback(true);
                        }
                        return;
                    }
                    apply(runners, function (runner) {
                        runner.forceMinPriority(handshake.transport.priority);
                    });
                    callback(null, handshake);
                };
            });
        };
        return BestConnectedEverStrategy;
    }());
    /* harmony default export */ var best_connected_ever_strategy = (best_connected_ever_strategy_BestConnectedEverStrategy);
    function connect(strategies, minPriority, callbackBuilder) {
        var runners = map(strategies, function (strategy, i, _, rs) {
            return strategy.connect(minPriority, callbackBuilder(i, rs));
        });
        return {
            abort: function () {
                apply(runners, abortRunner);
            },
            forceMinPriority: function (p) {
                apply(runners, function (runner) {
                    runner.forceMinPriority(p);
                });
            }
        };
    }
    function allRunnersFailed(runners) {
        return collections_all(runners, function (runner) {
            return Boolean(runner.error);
        });
    }
    function abortRunner(runner) {
        if (!runner.error && !runner.aborted) {
            runner.abort();
            runner.aborted = true;
        }
    }

    // CONCATENATED MODULE: ./src/core/strategies/cached_strategy.ts




    var cached_strategy_CachedStrategy = (function () {
        function CachedStrategy(strategy, transports, options) {
            this.strategy = strategy;
            this.transports = transports;
            this.ttl = options.ttl || 1800 * 1000;
            this.usingTLS = options.useTLS;
            this.timeline = options.timeline;
        }
        CachedStrategy.prototype.isSupported = function () {
            return this.strategy.isSupported();
        };
        CachedStrategy.prototype.connect = function (minPriority, callback) {
            var usingTLS = this.usingTLS;
            var info = fetchTransportCache(usingTLS);
            var strategies = [this.strategy];
            if (info && info.timestamp + this.ttl >= util.now()) {
                var transport = this.transports[info.transport];
                if (transport) {
                    this.timeline.info({
                        cached: true,
                        transport: info.transport,
                        latency: info.latency
                    });
                    strategies.push(new sequential_strategy([transport], {
                        timeout: info.latency * 2 + 1000,
                        failFast: true
                    }));
                }
            }
            var startTimestamp = util.now();
            var runner = strategies
                .pop()
                .connect(minPriority, function cb(error, handshake) {
                if (error) {
                    flushTransportCache(usingTLS);
                    if (strategies.length > 0) {
                        startTimestamp = util.now();
                        runner = strategies.pop().connect(minPriority, cb);
                    }
                    else {
                        callback(error);
                    }
                }
                else {
                    storeTransportCache(usingTLS, handshake.transport.name, util.now() - startTimestamp);
                    callback(null, handshake);
                }
            });
            return {
                abort: function () {
                    runner.abort();
                },
                forceMinPriority: function (p) {
                    minPriority = p;
                    if (runner) {
                        runner.forceMinPriority(p);
                    }
                }
            };
        };
        return CachedStrategy;
    }());
    /* harmony default export */ var cached_strategy = (cached_strategy_CachedStrategy);
    function getTransportCacheKey(usingTLS) {
        return 'pusherTransport' + (usingTLS ? 'TLS' : 'NonTLS');
    }
    function fetchTransportCache(usingTLS) {
        var storage = runtime.getLocalStorage();
        if (storage) {
            try {
                var serializedCache = storage[getTransportCacheKey(usingTLS)];
                if (serializedCache) {
                    return JSON.parse(serializedCache);
                }
            }
            catch (e) {
                flushTransportCache(usingTLS);
            }
        }
        return null;
    }
    function storeTransportCache(usingTLS, transport, latency) {
        var storage = runtime.getLocalStorage();
        if (storage) {
            try {
                storage[getTransportCacheKey(usingTLS)] = safeJSONStringify({
                    timestamp: util.now(),
                    transport: transport,
                    latency: latency
                });
            }
            catch (e) {
            }
        }
    }
    function flushTransportCache(usingTLS) {
        var storage = runtime.getLocalStorage();
        if (storage) {
            try {
                delete storage[getTransportCacheKey(usingTLS)];
            }
            catch (e) {
            }
        }
    }

    // CONCATENATED MODULE: ./src/core/strategies/delayed_strategy.ts

    var delayed_strategy_DelayedStrategy = (function () {
        function DelayedStrategy(strategy, _a) {
            var number = _a.delay;
            this.strategy = strategy;
            this.options = { delay: number };
        }
        DelayedStrategy.prototype.isSupported = function () {
            return this.strategy.isSupported();
        };
        DelayedStrategy.prototype.connect = function (minPriority, callback) {
            var strategy = this.strategy;
            var runner;
            var timer = new OneOffTimer(this.options.delay, function () {
                runner = strategy.connect(minPriority, callback);
            });
            return {
                abort: function () {
                    timer.ensureAborted();
                    if (runner) {
                        runner.abort();
                    }
                },
                forceMinPriority: function (p) {
                    minPriority = p;
                    if (runner) {
                        runner.forceMinPriority(p);
                    }
                }
            };
        };
        return DelayedStrategy;
    }());
    /* harmony default export */ var delayed_strategy = (delayed_strategy_DelayedStrategy);

    // CONCATENATED MODULE: ./src/core/strategies/if_strategy.ts
    var IfStrategy = (function () {
        function IfStrategy(test, trueBranch, falseBranch) {
            this.test = test;
            this.trueBranch = trueBranch;
            this.falseBranch = falseBranch;
        }
        IfStrategy.prototype.isSupported = function () {
            var branch = this.test() ? this.trueBranch : this.falseBranch;
            return branch.isSupported();
        };
        IfStrategy.prototype.connect = function (minPriority, callback) {
            var branch = this.test() ? this.trueBranch : this.falseBranch;
            return branch.connect(minPriority, callback);
        };
        return IfStrategy;
    }());
    /* harmony default export */ var if_strategy = (IfStrategy);

    // CONCATENATED MODULE: ./src/core/strategies/first_connected_strategy.ts
    var FirstConnectedStrategy = (function () {
        function FirstConnectedStrategy(strategy) {
            this.strategy = strategy;
        }
        FirstConnectedStrategy.prototype.isSupported = function () {
            return this.strategy.isSupported();
        };
        FirstConnectedStrategy.prototype.connect = function (minPriority, callback) {
            var runner = this.strategy.connect(minPriority, function (error, handshake) {
                if (handshake) {
                    runner.abort();
                }
                callback(error, handshake);
            });
            return runner;
        };
        return FirstConnectedStrategy;
    }());
    /* harmony default export */ var first_connected_strategy = (FirstConnectedStrategy);

    // CONCATENATED MODULE: ./src/runtimes/web/default_strategy.ts







    function testSupportsStrategy(strategy) {
        return function () {
            return strategy.isSupported();
        };
    }
    var getDefaultStrategy = function (config, baseOptions, defineTransport) {
        var definedTransports = {};
        function defineTransportStrategy(name, type, priority, options, manager) {
            var transport = defineTransport(config, name, type, priority, options, manager);
            definedTransports[name] = transport;
            return transport;
        }
        var ws_options = Object.assign({}, baseOptions, {
            hostNonTLS: config.wsHost + ':' + config.wsPort,
            hostTLS: config.wsHost + ':' + config.wssPort,
            httpPath: config.wsPath
        });
        var wss_options = Object.assign({}, ws_options, {
            useTLS: true
        });
        var sockjs_options = Object.assign({}, baseOptions, {
            hostNonTLS: config.httpHost + ':' + config.httpPort,
            hostTLS: config.httpHost + ':' + config.httpsPort,
            httpPath: config.httpPath
        });
        var timeouts = {
            loop: true,
            timeout: 15000,
            timeoutLimit: 60000
        };
        var ws_manager = new transport_manager({
            lives: 2,
            minPingDelay: 10000,
            maxPingDelay: config.activityTimeout
        });
        var streaming_manager = new transport_manager({
            lives: 2,
            minPingDelay: 10000,
            maxPingDelay: config.activityTimeout
        });
        var ws_transport = defineTransportStrategy('ws', 'ws', 3, ws_options, ws_manager);
        var wss_transport = defineTransportStrategy('wss', 'ws', 3, wss_options, ws_manager);
        var sockjs_transport = defineTransportStrategy('sockjs', 'sockjs', 1, sockjs_options);
        var xhr_streaming_transport = defineTransportStrategy('xhr_streaming', 'xhr_streaming', 1, sockjs_options, streaming_manager);
        var xdr_streaming_transport = defineTransportStrategy('xdr_streaming', 'xdr_streaming', 1, sockjs_options, streaming_manager);
        var xhr_polling_transport = defineTransportStrategy('xhr_polling', 'xhr_polling', 1, sockjs_options);
        var xdr_polling_transport = defineTransportStrategy('xdr_polling', 'xdr_polling', 1, sockjs_options);
        var ws_loop = new sequential_strategy([ws_transport], timeouts);
        var wss_loop = new sequential_strategy([wss_transport], timeouts);
        var sockjs_loop = new sequential_strategy([sockjs_transport], timeouts);
        var streaming_loop = new sequential_strategy([
            new if_strategy(testSupportsStrategy(xhr_streaming_transport), xhr_streaming_transport, xdr_streaming_transport)
        ], timeouts);
        var polling_loop = new sequential_strategy([
            new if_strategy(testSupportsStrategy(xhr_polling_transport), xhr_polling_transport, xdr_polling_transport)
        ], timeouts);
        var http_loop = new sequential_strategy([
            new if_strategy(testSupportsStrategy(streaming_loop), new best_connected_ever_strategy([
                streaming_loop,
                new delayed_strategy(polling_loop, { delay: 4000 })
            ]), polling_loop)
        ], timeouts);
        var http_fallback_loop = new if_strategy(testSupportsStrategy(http_loop), http_loop, sockjs_loop);
        var wsStrategy;
        if (baseOptions.useTLS) {
            wsStrategy = new best_connected_ever_strategy([
                ws_loop,
                new delayed_strategy(http_fallback_loop, { delay: 2000 })
            ]);
        }
        else {
            wsStrategy = new best_connected_ever_strategy([
                ws_loop,
                new delayed_strategy(wss_loop, { delay: 2000 }),
                new delayed_strategy(http_fallback_loop, { delay: 5000 })
            ]);
        }
        return new cached_strategy(new first_connected_strategy(new if_strategy(testSupportsStrategy(ws_transport), wsStrategy, http_fallback_loop)), definedTransports, {
            ttl: 1800000,
            timeline: baseOptions.timeline,
            useTLS: baseOptions.useTLS
        });
    };
    /* harmony default export */ var default_strategy = (getDefaultStrategy);

    // CONCATENATED MODULE: ./src/runtimes/web/transports/transport_connection_initializer.ts

    /* harmony default export */ var transport_connection_initializer = (function () {
        var self = this;
        self.timeline.info(self.buildTimelineMessage({
            transport: self.name + (self.options.useTLS ? 's' : '')
        }));
        if (self.hooks.isInitialized()) {
            self.changeState('initialized');
        }
        else if (self.hooks.file) {
            self.changeState('initializing');
            Dependencies.load(self.hooks.file, { useTLS: self.options.useTLS }, function (error, callback) {
                if (self.hooks.isInitialized()) {
                    self.changeState('initialized');
                    callback(true);
                }
                else {
                    if (error) {
                        self.onError(error);
                    }
                    self.onClose();
                    callback(false);
                }
            });
        }
        else {
            self.onClose();
        }
    });

    // CONCATENATED MODULE: ./src/runtimes/web/http/http_xdomain_request.ts

    var http_xdomain_request_hooks = {
        getRequest: function (socket) {
            var xdr = new window.XDomainRequest();
            xdr.ontimeout = function () {
                socket.emit('error', new RequestTimedOut());
                socket.close();
            };
            xdr.onerror = function (e) {
                socket.emit('error', e);
                socket.close();
            };
            xdr.onprogress = function () {
                if (xdr.responseText && xdr.responseText.length > 0) {
                    socket.onChunk(200, xdr.responseText);
                }
            };
            xdr.onload = function () {
                if (xdr.responseText && xdr.responseText.length > 0) {
                    socket.onChunk(200, xdr.responseText);
                }
                socket.emit('finished', 200);
                socket.close();
            };
            return xdr;
        },
        abortRequest: function (xdr) {
            xdr.ontimeout = xdr.onerror = xdr.onprogress = xdr.onload = null;
            xdr.abort();
        }
    };
    /* harmony default export */ var http_xdomain_request = (http_xdomain_request_hooks);

    // CONCATENATED MODULE: ./src/core/http/http_request.ts
    var http_request_extends = (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();


    var MAX_BUFFER_LENGTH = 256 * 1024;
    var http_request_HTTPRequest = (function (_super) {
        http_request_extends(HTTPRequest, _super);
        function HTTPRequest(hooks, method, url) {
            var _this = _super.call(this) || this;
            _this.hooks = hooks;
            _this.method = method;
            _this.url = url;
            return _this;
        }
        HTTPRequest.prototype.start = function (payload) {
            var _this = this;
            this.position = 0;
            this.xhr = this.hooks.getRequest(this);
            this.unloader = function () {
                _this.close();
            };
            runtime.addUnloadListener(this.unloader);
            this.xhr.open(this.method, this.url, true);
            if (this.xhr.setRequestHeader) {
                this.xhr.setRequestHeader('Content-Type', 'application/json');
            }
            this.xhr.send(payload);
        };
        HTTPRequest.prototype.close = function () {
            if (this.unloader) {
                runtime.removeUnloadListener(this.unloader);
                this.unloader = null;
            }
            if (this.xhr) {
                this.hooks.abortRequest(this.xhr);
                this.xhr = null;
            }
        };
        HTTPRequest.prototype.onChunk = function (status, data) {
            while (true) {
                var chunk = this.advanceBuffer(data);
                if (chunk) {
                    this.emit('chunk', { status: status, data: chunk });
                }
                else {
                    break;
                }
            }
            if (this.isBufferTooLong(data)) {
                this.emit('buffer_too_long');
            }
        };
        HTTPRequest.prototype.advanceBuffer = function (buffer) {
            var unreadData = buffer.slice(this.position);
            var endOfLinePosition = unreadData.indexOf('\n');
            if (endOfLinePosition !== -1) {
                this.position += endOfLinePosition + 1;
                return unreadData.slice(0, endOfLinePosition);
            }
            else {
                return null;
            }
        };
        HTTPRequest.prototype.isBufferTooLong = function (buffer) {
            return this.position === buffer.length && buffer.length > MAX_BUFFER_LENGTH;
        };
        return HTTPRequest;
    }(dispatcher));
    /* harmony default export */ var http_request = (http_request_HTTPRequest);

    // CONCATENATED MODULE: ./src/core/http/state.ts
    var State;
    (function (State) {
        State[State["CONNECTING"] = 0] = "CONNECTING";
        State[State["OPEN"] = 1] = "OPEN";
        State[State["CLOSED"] = 3] = "CLOSED";
    })(State || (State = {}));
    /* harmony default export */ var state = (State);

    // CONCATENATED MODULE: ./src/core/http/http_socket.ts



    var autoIncrement = 1;
    var http_socket_HTTPSocket = (function () {
        function HTTPSocket(hooks, url) {
            this.hooks = hooks;
            this.session = randomNumber(1000) + '/' + randomString(8);
            this.location = getLocation(url);
            this.readyState = state.CONNECTING;
            this.openStream();
        }
        HTTPSocket.prototype.send = function (payload) {
            return this.sendRaw(JSON.stringify([payload]));
        };
        HTTPSocket.prototype.ping = function () {
            this.hooks.sendHeartbeat(this);
        };
        HTTPSocket.prototype.close = function (code, reason) {
            this.onClose(code, reason, true);
        };
        HTTPSocket.prototype.sendRaw = function (payload) {
            if (this.readyState === state.OPEN) {
                try {
                    runtime.createSocketRequest('POST', getUniqueURL(getSendURL(this.location, this.session))).start(payload);
                    return true;
                }
                catch (e) {
                    return false;
                }
            }
            else {
                return false;
            }
        };
        HTTPSocket.prototype.reconnect = function () {
            this.closeStream();
            this.openStream();
        };
        HTTPSocket.prototype.onClose = function (code, reason, wasClean) {
            this.closeStream();
            this.readyState = state.CLOSED;
            if (this.onclose) {
                this.onclose({
                    code: code,
                    reason: reason,
                    wasClean: wasClean
                });
            }
        };
        HTTPSocket.prototype.onChunk = function (chunk) {
            if (chunk.status !== 200) {
                return;
            }
            if (this.readyState === state.OPEN) {
                this.onActivity();
            }
            var payload;
            var type = chunk.data.slice(0, 1);
            switch (type) {
                case 'o':
                    payload = JSON.parse(chunk.data.slice(1) || '{}');
                    this.onOpen(payload);
                    break;
                case 'a':
                    payload = JSON.parse(chunk.data.slice(1) || '[]');
                    for (var i = 0; i < payload.length; i++) {
                        this.onEvent(payload[i]);
                    }
                    break;
                case 'm':
                    payload = JSON.parse(chunk.data.slice(1) || 'null');
                    this.onEvent(payload);
                    break;
                case 'h':
                    this.hooks.onHeartbeat(this);
                    break;
                case 'c':
                    payload = JSON.parse(chunk.data.slice(1) || '[]');
                    this.onClose(payload[0], payload[1], true);
                    break;
            }
        };
        HTTPSocket.prototype.onOpen = function (options) {
            if (this.readyState === state.CONNECTING) {
                if (options && options.hostname) {
                    this.location.base = replaceHost(this.location.base, options.hostname);
                }
                this.readyState = state.OPEN;
                if (this.onopen) {
                    this.onopen();
                }
            }
            else {
                this.onClose(1006, 'Server lost session', true);
            }
        };
        HTTPSocket.prototype.onEvent = function (event) {
            if (this.readyState === state.OPEN && this.onmessage) {
                this.onmessage({ data: event });
            }
        };
        HTTPSocket.prototype.onActivity = function () {
            if (this.onactivity) {
                this.onactivity();
            }
        };
        HTTPSocket.prototype.onError = function (error) {
            if (this.onerror) {
                this.onerror(error);
            }
        };
        HTTPSocket.prototype.openStream = function () {
            var _this = this;
            this.stream = runtime.createSocketRequest('POST', getUniqueURL(this.hooks.getReceiveURL(this.location, this.session)));
            this.stream.bind('chunk', function (chunk) {
                _this.onChunk(chunk);
            });
            this.stream.bind('finished', function (status) {
                _this.hooks.onFinished(_this, status);
            });
            this.stream.bind('buffer_too_long', function () {
                _this.reconnect();
            });
            try {
                this.stream.start();
            }
            catch (error) {
                util.defer(function () {
                    _this.onError(error);
                    _this.onClose(1006, 'Could not start streaming', false);
                });
            }
        };
        HTTPSocket.prototype.closeStream = function () {
            if (this.stream) {
                this.stream.unbind_all();
                this.stream.close();
                this.stream = null;
            }
        };
        return HTTPSocket;
    }());
    function getLocation(url) {
        var parts = /([^\?]*)\/*(\??.*)/.exec(url);
        return {
            base: parts[1],
            queryString: parts[2]
        };
    }
    function getSendURL(url, session) {
        return url.base + '/' + session + '/xhr_send';
    }
    function getUniqueURL(url) {
        var separator = url.indexOf('?') === -1 ? '?' : '&';
        return url + separator + 't=' + +new Date() + '&n=' + autoIncrement++;
    }
    function replaceHost(url, hostname) {
        var urlParts = /(https?:\/\/)([^\/:]+)((\/|:)?.*)/.exec(url);
        return urlParts[1] + hostname + urlParts[3];
    }
    function randomNumber(max) {
        return Math.floor(Math.random() * max);
    }
    function randomString(length) {
        var result = [];
        for (var i = 0; i < length; i++) {
            result.push(randomNumber(32).toString(32));
        }
        return result.join('');
    }
    /* harmony default export */ var http_socket = (http_socket_HTTPSocket);

    // CONCATENATED MODULE: ./src/core/http/http_streaming_socket.ts
    var http_streaming_socket_hooks = {
        getReceiveURL: function (url, session) {
            return url.base + '/' + session + '/xhr_streaming' + url.queryString;
        },
        onHeartbeat: function (socket) {
            socket.sendRaw('[]');
        },
        sendHeartbeat: function (socket) {
            socket.sendRaw('[]');
        },
        onFinished: function (socket, status) {
            socket.onClose(1006, 'Connection interrupted (' + status + ')', false);
        }
    };
    /* harmony default export */ var http_streaming_socket = (http_streaming_socket_hooks);

    // CONCATENATED MODULE: ./src/core/http/http_polling_socket.ts
    var http_polling_socket_hooks = {
        getReceiveURL: function (url, session) {
            return url.base + '/' + session + '/xhr' + url.queryString;
        },
        onHeartbeat: function () {
        },
        sendHeartbeat: function (socket) {
            socket.sendRaw('[]');
        },
        onFinished: function (socket, status) {
            if (status === 200) {
                socket.reconnect();
            }
            else {
                socket.onClose(1006, 'Connection interrupted (' + status + ')', false);
            }
        }
    };
    /* harmony default export */ var http_polling_socket = (http_polling_socket_hooks);

    // CONCATENATED MODULE: ./src/runtimes/isomorphic/http/http_xhr_request.ts

    var http_xhr_request_hooks = {
        getRequest: function (socket) {
            var Constructor = runtime.getXHRAPI();
            var xhr = new Constructor();
            xhr.onreadystatechange = xhr.onprogress = function () {
                switch (xhr.readyState) {
                    case 3:
                        if (xhr.responseText && xhr.responseText.length > 0) {
                            socket.onChunk(xhr.status, xhr.responseText);
                        }
                        break;
                    case 4:
                        if (xhr.responseText && xhr.responseText.length > 0) {
                            socket.onChunk(xhr.status, xhr.responseText);
                        }
                        socket.emit('finished', xhr.status);
                        socket.close();
                        break;
                }
            };
            return xhr;
        },
        abortRequest: function (xhr) {
            xhr.onreadystatechange = null;
            xhr.abort();
        }
    };
    /* harmony default export */ var http_xhr_request = (http_xhr_request_hooks);

    // CONCATENATED MODULE: ./src/runtimes/isomorphic/http/http.ts





    var HTTP = {
        createStreamingSocket: function (url) {
            return this.createSocket(http_streaming_socket, url);
        },
        createPollingSocket: function (url) {
            return this.createSocket(http_polling_socket, url);
        },
        createSocket: function (hooks, url) {
            return new http_socket(hooks, url);
        },
        createXHR: function (method, url) {
            return this.createRequest(http_xhr_request, method, url);
        },
        createRequest: function (hooks, method, url) {
            return new http_request(hooks, method, url);
        }
    };
    /* harmony default export */ var http_http = (HTTP);

    // CONCATENATED MODULE: ./src/runtimes/web/http/http.ts


    http_http.createXDR = function (method, url) {
        return this.createRequest(http_xdomain_request, method, url);
    };
    /* harmony default export */ var web_http_http = (http_http);

    // CONCATENATED MODULE: ./src/runtimes/web/runtime.ts












    var Runtime = {
        nextAuthCallbackID: 1,
        auth_callbacks: {},
        ScriptReceivers: ScriptReceivers,
        DependenciesReceivers: DependenciesReceivers,
        getDefaultStrategy: default_strategy,
        Transports: transports_transports,
        transportConnectionInitializer: transport_connection_initializer,
        HTTPFactory: web_http_http,
        TimelineTransport: jsonp_timeline,
        getXHRAPI: function () {
            return window.XMLHttpRequest;
        },
        getWebSocketAPI: function () {
            return window.WebSocket || window.MozWebSocket;
        },
        setup: function (PusherClass) {
            var _this = this;
            window.Pusher = PusherClass;
            var initializeOnDocumentBody = function () {
                _this.onDocumentBody(PusherClass.ready);
            };
            if (!window.JSON) {
                Dependencies.load('json2', {}, initializeOnDocumentBody);
            }
            else {
                initializeOnDocumentBody();
            }
        },
        getDocument: function () {
            return document;
        },
        getProtocol: function () {
            return this.getDocument().location.protocol;
        },
        getAuthorizers: function () {
            return { ajax: xhr_auth, jsonp: jsonp_auth };
        },
        onDocumentBody: function (callback) {
            var _this = this;
            if (document.body) {
                callback();
            }
            else {
                setTimeout(function () {
                    _this.onDocumentBody(callback);
                }, 0);
            }
        },
        createJSONPRequest: function (url, data) {
            return new jsonp_request(url, data);
        },
        createScriptRequest: function (src) {
            return new script_request(src);
        },
        getLocalStorage: function () {
            try {
                return window.localStorage;
            }
            catch (e) {
                return undefined;
            }
        },
        createXHR: function () {
            if (this.getXHRAPI()) {
                return this.createXMLHttpRequest();
            }
            else {
                return this.createMicrosoftXHR();
            }
        },
        createXMLHttpRequest: function () {
            var Constructor = this.getXHRAPI();
            return new Constructor();
        },
        createMicrosoftXHR: function () {
            return new ActiveXObject('Microsoft.XMLHTTP');
        },
        getNetwork: function () {
            return net_info_Network;
        },
        createWebSocket: function (url) {
            var Constructor = this.getWebSocketAPI();
            return new Constructor(url);
        },
        createSocketRequest: function (method, url) {
            if (this.isXHRSupported()) {
                return this.HTTPFactory.createXHR(method, url);
            }
            else if (this.isXDRSupported(url.indexOf('https:') === 0)) {
                return this.HTTPFactory.createXDR(method, url);
            }
            else {
                throw 'Cross-origin HTTP requests are not supported';
            }
        },
        isXHRSupported: function () {
            var Constructor = this.getXHRAPI();
            return (Boolean(Constructor) && new Constructor().withCredentials !== undefined);
        },
        isXDRSupported: function (useTLS) {
            var protocol = useTLS ? 'https:' : 'http:';
            var documentProtocol = this.getProtocol();
            return (Boolean(window['XDomainRequest']) && documentProtocol === protocol);
        },
        addUnloadListener: function (listener) {
            if (window.addEventListener !== undefined) {
                window.addEventListener('unload', listener, false);
            }
            else if (window.attachEvent !== undefined) {
                window.attachEvent('onunload', listener);
            }
        },
        removeUnloadListener: function (listener) {
            if (window.addEventListener !== undefined) {
                window.removeEventListener('unload', listener, false);
            }
            else if (window.detachEvent !== undefined) {
                window.detachEvent('onunload', listener);
            }
        }
    };
    /* harmony default export */ var runtime = (Runtime);

    // CONCATENATED MODULE: ./src/core/timeline/level.ts
    var TimelineLevel;
    (function (TimelineLevel) {
        TimelineLevel[TimelineLevel["ERROR"] = 3] = "ERROR";
        TimelineLevel[TimelineLevel["INFO"] = 6] = "INFO";
        TimelineLevel[TimelineLevel["DEBUG"] = 7] = "DEBUG";
    })(TimelineLevel || (TimelineLevel = {}));
    /* harmony default export */ var timeline_level = (TimelineLevel);

    // CONCATENATED MODULE: ./src/core/timeline/timeline.ts



    var timeline_Timeline = (function () {
        function Timeline(key, session, options) {
            this.key = key;
            this.session = session;
            this.events = [];
            this.options = options || {};
            this.sent = 0;
            this.uniqueID = 0;
        }
        Timeline.prototype.log = function (level, event) {
            if (level <= this.options.level) {
                this.events.push(extend({}, event, { timestamp: util.now() }));
                if (this.options.limit && this.events.length > this.options.limit) {
                    this.events.shift();
                }
            }
        };
        Timeline.prototype.error = function (event) {
            this.log(timeline_level.ERROR, event);
        };
        Timeline.prototype.info = function (event) {
            this.log(timeline_level.INFO, event);
        };
        Timeline.prototype.debug = function (event) {
            this.log(timeline_level.DEBUG, event);
        };
        Timeline.prototype.isEmpty = function () {
            return this.events.length === 0;
        };
        Timeline.prototype.send = function (sendfn, callback) {
            var _this = this;
            var data = extend({
                session: this.session,
                bundle: this.sent + 1,
                key: this.key,
                lib: 'js',
                version: this.options.version,
                cluster: this.options.cluster,
                features: this.options.features,
                timeline: this.events
            }, this.options.params);
            this.events = [];
            sendfn(data, function (error, result) {
                if (!error) {
                    _this.sent++;
                }
                if (callback) {
                    callback(error, result);
                }
            });
            return true;
        };
        Timeline.prototype.generateUniqueID = function () {
            this.uniqueID++;
            return this.uniqueID;
        };
        return Timeline;
    }());
    /* harmony default export */ var timeline_timeline = (timeline_Timeline);

    // CONCATENATED MODULE: ./src/core/strategies/transport_strategy.ts




    var transport_strategy_TransportStrategy = (function () {
        function TransportStrategy(name, priority, transport, options) {
            this.name = name;
            this.priority = priority;
            this.transport = transport;
            this.options = options || {};
        }
        TransportStrategy.prototype.isSupported = function () {
            return this.transport.isSupported({
                useTLS: this.options.useTLS
            });
        };
        TransportStrategy.prototype.connect = function (minPriority, callback) {
            var _this = this;
            if (!this.isSupported()) {
                return failAttempt(new UnsupportedStrategy(), callback);
            }
            else if (this.priority < minPriority) {
                return failAttempt(new TransportPriorityTooLow(), callback);
            }
            var connected = false;
            var transport = this.transport.createConnection(this.name, this.priority, this.options.key, this.options);
            var handshake = null;
            var onInitialized = function () {
                transport.unbind('initialized', onInitialized);
                transport.connect();
            };
            var onOpen = function () {
                handshake = factory.createHandshake(transport, function (result) {
                    connected = true;
                    unbindListeners();
                    callback(null, result);
                });
            };
            var onError = function (error) {
                unbindListeners();
                callback(error);
            };
            var onClosed = function () {
                unbindListeners();
                var serializedTransport;
                serializedTransport = safeJSONStringify(transport);
                callback(new TransportClosed(serializedTransport));
            };
            var unbindListeners = function () {
                transport.unbind('initialized', onInitialized);
                transport.unbind('open', onOpen);
                transport.unbind('error', onError);
                transport.unbind('closed', onClosed);
            };
            transport.bind('initialized', onInitialized);
            transport.bind('open', onOpen);
            transport.bind('error', onError);
            transport.bind('closed', onClosed);
            transport.initialize();
            return {
                abort: function () {
                    if (connected) {
                        return;
                    }
                    unbindListeners();
                    if (handshake) {
                        handshake.close();
                    }
                    else {
                        transport.close();
                    }
                },
                forceMinPriority: function (p) {
                    if (connected) {
                        return;
                    }
                    if (_this.priority < p) {
                        if (handshake) {
                            handshake.close();
                        }
                        else {
                            transport.close();
                        }
                    }
                }
            };
        };
        return TransportStrategy;
    }());
    /* harmony default export */ var transport_strategy = (transport_strategy_TransportStrategy);
    function failAttempt(error, callback) {
        util.defer(function () {
            callback(error);
        });
        return {
            abort: function () { },
            forceMinPriority: function () { }
        };
    }

    // CONCATENATED MODULE: ./src/core/strategies/strategy_builder.ts





    var strategy_builder_Transports = runtime.Transports;
    var strategy_builder_defineTransport = function (config, name, type, priority, options, manager) {
        var transportClass = strategy_builder_Transports[type];
        if (!transportClass) {
            throw new UnsupportedTransport(type);
        }
        var enabled = (!config.enabledTransports ||
            arrayIndexOf(config.enabledTransports, name) !== -1) &&
            (!config.disabledTransports ||
                arrayIndexOf(config.disabledTransports, name) === -1);
        var transport;
        if (enabled) {
            options = Object.assign({ ignoreNullOrigin: config.ignoreNullOrigin }, options);
            transport = new transport_strategy(name, priority, manager ? manager.getAssistant(transportClass) : transportClass, options);
        }
        else {
            transport = strategy_builder_UnsupportedStrategy;
        }
        return transport;
    };
    var strategy_builder_UnsupportedStrategy = {
        isSupported: function () {
            return false;
        },
        connect: function (_, callback) {
            var deferred = util.defer(function () {
                callback(new UnsupportedStrategy());
            });
            return {
                abort: function () {
                    deferred.ensureAborted();
                },
                forceMinPriority: function () { }
            };
        }
    };

    // CONCATENATED MODULE: ./src/core/config.ts


    function getConfig(opts) {
        var config = {
            activityTimeout: opts.activityTimeout || defaults.activityTimeout,
            authEndpoint: opts.authEndpoint || defaults.authEndpoint,
            authTransport: opts.authTransport || defaults.authTransport,
            cluster: opts.cluster || defaults.cluster,
            httpPath: opts.httpPath || defaults.httpPath,
            httpPort: opts.httpPort || defaults.httpPort,
            httpsPort: opts.httpsPort || defaults.httpsPort,
            pongTimeout: opts.pongTimeout || defaults.pongTimeout,
            statsHost: opts.statsHost || defaults.stats_host,
            unavailableTimeout: opts.unavailableTimeout || defaults.unavailableTimeout,
            wsPath: opts.wsPath || defaults.wsPath,
            wsPort: opts.wsPort || defaults.wsPort,
            wssPort: opts.wssPort || defaults.wssPort,
            enableStats: getEnableStatsConfig(opts),
            httpHost: getHttpHost(opts),
            useTLS: shouldUseTLS(opts),
            wsHost: getWebsocketHost(opts)
        };
        if ('auth' in opts)
            config.auth = opts.auth;
        if ('authorizer' in opts)
            config.authorizer = opts.authorizer;
        if ('disabledTransports' in opts)
            config.disabledTransports = opts.disabledTransports;
        if ('enabledTransports' in opts)
            config.enabledTransports = opts.enabledTransports;
        if ('ignoreNullOrigin' in opts)
            config.ignoreNullOrigin = opts.ignoreNullOrigin;
        if ('timelineParams' in opts)
            config.timelineParams = opts.timelineParams;
        if ('nacl' in opts) {
            config.nacl = opts.nacl;
        }
        return config;
    }
    function getHttpHost(opts) {
        if (opts.httpHost) {
            return opts.httpHost;
        }
        if (opts.cluster) {
            return "sockjs-" + opts.cluster + ".pusher.com";
        }
        return defaults.httpHost;
    }
    function getWebsocketHost(opts) {
        if (opts.wsHost) {
            return opts.wsHost;
        }
        if (opts.cluster) {
            return getWebsocketHostFromCluster(opts.cluster);
        }
        return getWebsocketHostFromCluster(defaults.cluster);
    }
    function getWebsocketHostFromCluster(cluster) {
        return "ws-" + cluster + ".pusher.com";
    }
    function shouldUseTLS(opts) {
        if (runtime.getProtocol() === 'https:') {
            return true;
        }
        else if (opts.forceTLS === false) {
            return false;
        }
        return true;
    }
    function getEnableStatsConfig(opts) {
        if ('enableStats' in opts) {
            return opts.enableStats;
        }
        if ('disableStats' in opts) {
            return !opts.disableStats;
        }
        return false;
    }

    // CONCATENATED MODULE: ./src/core/pusher.ts












    var pusher_Pusher = (function () {
        function Pusher(app_key, options) {
            var _this = this;
            checkAppKey(app_key);
            options = options || {};
            if (!options.cluster && !(options.wsHost || options.httpHost)) {
                var suffix = url_store.buildLogSuffix('javascriptQuickStart');
                logger.warn("You should always specify a cluster when connecting. " + suffix);
            }
            if ('disableStats' in options) {
                logger.warn('The disableStats option is deprecated in favor of enableStats');
            }
            this.key = app_key;
            this.config = getConfig(options);
            this.channels = factory.createChannels();
            this.global_emitter = new dispatcher();
            this.sessionID = Math.floor(Math.random() * 1000000000);
            this.timeline = new timeline_timeline(this.key, this.sessionID, {
                cluster: this.config.cluster,
                features: Pusher.getClientFeatures(),
                params: this.config.timelineParams || {},
                limit: 50,
                level: timeline_level.INFO,
                version: defaults.VERSION
            });
            if (this.config.enableStats) {
                this.timelineSender = factory.createTimelineSender(this.timeline, {
                    host: this.config.statsHost,
                    path: '/timeline/v2/' + runtime.TimelineTransport.name
                });
            }
            var getStrategy = function (options) {
                return runtime.getDefaultStrategy(_this.config, options, strategy_builder_defineTransport);
            };
            this.connection = factory.createConnectionManager(this.key, {
                getStrategy: getStrategy,
                timeline: this.timeline,
                activityTimeout: this.config.activityTimeout,
                pongTimeout: this.config.pongTimeout,
                unavailableTimeout: this.config.unavailableTimeout,
                useTLS: Boolean(this.config.useTLS)
            });
            this.connection.bind('connected', function () {
                _this.subscribeAll();
                if (_this.timelineSender) {
                    _this.timelineSender.send(_this.connection.isUsingTLS());
                }
            });
            this.connection.bind('message', function (event) {
                var eventName = event.event;
                var internal = eventName.indexOf('pusher_internal:') === 0;
                if (event.channel) {
                    var channel = _this.channel(event.channel);
                    if (channel) {
                        channel.handleEvent(event);
                    }
                }
                if (!internal) {
                    _this.global_emitter.emit(event.event, event.data);
                }
            });
            this.connection.bind('connecting', function () {
                _this.channels.disconnect();
            });
            this.connection.bind('disconnected', function () {
                _this.channels.disconnect();
            });
            this.connection.bind('error', function (err) {
                logger.warn(err);
            });
            Pusher.instances.push(this);
            this.timeline.info({ instances: Pusher.instances.length });
            if (Pusher.isReady) {
                this.connect();
            }
        }
        Pusher.ready = function () {
            Pusher.isReady = true;
            for (var i = 0, l = Pusher.instances.length; i < l; i++) {
                Pusher.instances[i].connect();
            }
        };
        Pusher.getClientFeatures = function () {
            return keys(filterObject({ ws: runtime.Transports.ws }, function (t) {
                return t.isSupported({});
            }));
        };
        Pusher.prototype.channel = function (name) {
            return this.channels.find(name);
        };
        Pusher.prototype.allChannels = function () {
            return this.channels.all();
        };
        Pusher.prototype.connect = function () {
            this.connection.connect();
            if (this.timelineSender) {
                if (!this.timelineSenderTimer) {
                    var usingTLS = this.connection.isUsingTLS();
                    var timelineSender = this.timelineSender;
                    this.timelineSenderTimer = new PeriodicTimer(60000, function () {
                        timelineSender.send(usingTLS);
                    });
                }
            }
        };
        Pusher.prototype.disconnect = function () {
            this.connection.disconnect();
            if (this.timelineSenderTimer) {
                this.timelineSenderTimer.ensureAborted();
                this.timelineSenderTimer = null;
            }
        };
        Pusher.prototype.bind = function (event_name, callback, context) {
            this.global_emitter.bind(event_name, callback, context);
            return this;
        };
        Pusher.prototype.unbind = function (event_name, callback, context) {
            this.global_emitter.unbind(event_name, callback, context);
            return this;
        };
        Pusher.prototype.bind_global = function (callback) {
            this.global_emitter.bind_global(callback);
            return this;
        };
        Pusher.prototype.unbind_global = function (callback) {
            this.global_emitter.unbind_global(callback);
            return this;
        };
        Pusher.prototype.unbind_all = function (callback) {
            this.global_emitter.unbind_all();
            return this;
        };
        Pusher.prototype.subscribeAll = function () {
            var channelName;
            for (channelName in this.channels.channels) {
                if (this.channels.channels.hasOwnProperty(channelName)) {
                    this.subscribe(channelName);
                }
            }
        };
        Pusher.prototype.subscribe = function (channel_name) {
            var channel = this.channels.add(channel_name, this);
            if (channel.subscriptionPending && channel.subscriptionCancelled) {
                channel.reinstateSubscription();
            }
            else if (!channel.subscriptionPending &&
                this.connection.state === 'connected') {
                channel.subscribe();
            }
            return channel;
        };
        Pusher.prototype.unsubscribe = function (channel_name) {
            var channel = this.channels.find(channel_name);
            if (channel && channel.subscriptionPending) {
                channel.cancelSubscription();
            }
            else {
                channel = this.channels.remove(channel_name);
                if (channel && channel.subscribed) {
                    channel.unsubscribe();
                }
            }
        };
        Pusher.prototype.send_event = function (event_name, data, channel) {
            return this.connection.send_event(event_name, data, channel);
        };
        Pusher.prototype.shouldUseTLS = function () {
            return this.config.useTLS;
        };
        Pusher.instances = [];
        Pusher.isReady = false;
        Pusher.logToConsole = false;
        Pusher.Runtime = runtime;
        Pusher.ScriptReceivers = runtime.ScriptReceivers;
        Pusher.DependenciesReceivers = runtime.DependenciesReceivers;
        Pusher.auth_callbacks = runtime.auth_callbacks;
        return Pusher;
    }());
    /* harmony default export */ var core_pusher = __webpack_exports__["default"] = (pusher_Pusher);
    function checkAppKey(key) {
        if (key === null || key === undefined) {
            throw 'You must pass your app key when you instantiate Pusher.';
        }
    }
    runtime.setup(pusher_Pusher);


    /***/ })
    /******/ ]);
    });
    });

    var Pusher = /*@__PURE__*/getDefaultExportFromCjs(pusher);

    /**
     * Parses an URI
     *
     * @author Steven Levithan <stevenlevithan.com> (MIT license)
     * @api private
     */
    var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

    var parts = [
        'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
    ];

    var parseuri = function parseuri(str) {
        var src = str,
            b = str.indexOf('['),
            e = str.indexOf(']');

        if (b != -1 && e != -1) {
            str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
        }

        var m = re.exec(str || ''),
            uri = {},
            i = 14;

        while (i--) {
            uri[parts[i]] = m[i] || '';
        }

        if (b != -1 && e != -1) {
            uri.source = src;
            uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
            uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
            uri.ipv6uri = true;
        }

        uri.pathNames = pathNames(uri, uri['path']);
        uri.queryKey = queryKey(uri, uri['query']);

        return uri;
    };

    function pathNames(obj, path) {
        var regx = /\/{2,9}/g,
            names = path.replace(regx, "/").split("/");

        if (path.substr(0, 1) == '/' || path.length === 0) {
            names.splice(0, 1);
        }
        if (path.substr(path.length - 1, 1) == '/') {
            names.splice(names.length - 1, 1);
        }

        return names;
    }

    function queryKey(uri, query) {
        var data = {};

        query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ($0, $1, $2) {
            if ($1) {
                data[$1] = $2;
            }
        });

        return data;
    }

    /**
     * URL parser.
     *
     * @param uri - url
     * @param path - the request path of the connection
     * @param loc - An object meant to mimic window.location.
     *        Defaults to window.location.
     * @public
     */
    function url(uri, path = "", loc) {
        let obj = uri;
        // default to window.location
        loc = loc || (typeof location !== "undefined" && location);
        if (null == uri)
            uri = loc.protocol + "//" + loc.host;
        // relative path support
        if (typeof uri === "string") {
            if ("/" === uri.charAt(0)) {
                if ("/" === uri.charAt(1)) {
                    uri = loc.protocol + uri;
                }
                else {
                    uri = loc.host + uri;
                }
            }
            if (!/^(https?|wss?):\/\//.test(uri)) {
                if ("undefined" !== typeof loc) {
                    uri = loc.protocol + "//" + uri;
                }
                else {
                    uri = "https://" + uri;
                }
            }
            // parse
            obj = parseuri(uri);
        }
        // make sure we treat `localhost:80` and `localhost` equally
        if (!obj.port) {
            if (/^(http|ws)$/.test(obj.protocol)) {
                obj.port = "80";
            }
            else if (/^(http|ws)s$/.test(obj.protocol)) {
                obj.port = "443";
            }
        }
        obj.path = obj.path || "/";
        const ipv6 = obj.host.indexOf(":") !== -1;
        const host = ipv6 ? "[" + obj.host + "]" : obj.host;
        // define unique id
        obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
        // define href
        obj.href =
            obj.protocol +
                "://" +
                host +
                (loc && loc.port === obj.port ? "" : ":" + obj.port);
        return obj;
    }

    var hasCors = createCommonjsModule(function (module) {
    /**
     * Module exports.
     *
     * Logic borrowed from Modernizr:
     *
     *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
     */

    try {
      module.exports = typeof XMLHttpRequest !== 'undefined' &&
        'withCredentials' in new XMLHttpRequest();
    } catch (err) {
      // if XMLHttp support is disabled in IE then it will throw
      // when trying to create
      module.exports = false;
    }
    });

    var globalThis$1 = (() => {
        if (typeof self !== "undefined") {
            return self;
        }
        else if (typeof window !== "undefined") {
            return window;
        }
        else {
            return Function("return this")();
        }
    })();

    // browser shim for xmlhttprequest module
    function XMLHttpRequest$1 (opts) {
        const xdomain = opts.xdomain;
        // XMLHttpRequest can be disabled on IE
        try {
            if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCors)) {
                return new XMLHttpRequest();
            }
        }
        catch (e) { }
        if (!xdomain) {
            try {
                return new globalThis$1[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
            }
            catch (e) { }
        }
    }

    function pick(obj, ...attr) {
        return attr.reduce((acc, k) => {
            if (obj.hasOwnProperty(k)) {
                acc[k] = obj[k];
            }
            return acc;
        }, {});
    }
    // Keep a reference to the real timeout functions so they can be used when overridden
    const NATIVE_SET_TIMEOUT = setTimeout;
    const NATIVE_CLEAR_TIMEOUT = clearTimeout;
    function installTimerFunctions(obj, opts) {
        if (opts.useNativeTimers) {
            obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThis$1);
            obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThis$1);
        }
        else {
            obj.setTimeoutFn = setTimeout.bind(globalThis$1);
            obj.clearTimeoutFn = clearTimeout.bind(globalThis$1);
        }
    }

    /**
     * Expose `Emitter`.
     */

    var Emitter_1 = Emitter;

    /**
     * Initialize a new `Emitter`.
     *
     * @api public
     */

    function Emitter(obj) {
      if (obj) return mixin(obj);
    }

    /**
     * Mixin the emitter properties.
     *
     * @param {Object} obj
     * @return {Object}
     * @api private
     */

    function mixin(obj) {
      for (var key in Emitter.prototype) {
        obj[key] = Emitter.prototype[key];
      }
      return obj;
    }

    /**
     * Listen on the given `event` with `fn`.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.on =
    Emitter.prototype.addEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};
      (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
        .push(fn);
      return this;
    };

    /**
     * Adds an `event` listener that will be invoked a single
     * time then automatically removed.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.once = function(event, fn){
      function on() {
        this.off(event, on);
        fn.apply(this, arguments);
      }

      on.fn = fn;
      this.on(event, on);
      return this;
    };

    /**
     * Remove the given callback for `event` or all
     * registered callbacks.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.off =
    Emitter.prototype.removeListener =
    Emitter.prototype.removeAllListeners =
    Emitter.prototype.removeEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};

      // all
      if (0 == arguments.length) {
        this._callbacks = {};
        return this;
      }

      // specific event
      var callbacks = this._callbacks['$' + event];
      if (!callbacks) return this;

      // remove all handlers
      if (1 == arguments.length) {
        delete this._callbacks['$' + event];
        return this;
      }

      // remove specific handler
      var cb;
      for (var i = 0; i < callbacks.length; i++) {
        cb = callbacks[i];
        if (cb === fn || cb.fn === fn) {
          callbacks.splice(i, 1);
          break;
        }
      }

      // Remove event specific arrays for event types that no
      // one is subscribed for to avoid memory leak.
      if (callbacks.length === 0) {
        delete this._callbacks['$' + event];
      }

      return this;
    };

    /**
     * Emit `event` with the given args.
     *
     * @param {String} event
     * @param {Mixed} ...
     * @return {Emitter}
     */

    Emitter.prototype.emit = function(event){
      this._callbacks = this._callbacks || {};

      var args = new Array(arguments.length - 1)
        , callbacks = this._callbacks['$' + event];

      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }

      if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
          callbacks[i].apply(this, args);
        }
      }

      return this;
    };

    // alias used for reserved events (protected method)
    Emitter.prototype.emitReserved = Emitter.prototype.emit;

    /**
     * Return array of callbacks for `event`.
     *
     * @param {String} event
     * @return {Array}
     * @api public
     */

    Emitter.prototype.listeners = function(event){
      this._callbacks = this._callbacks || {};
      return this._callbacks['$' + event] || [];
    };

    /**
     * Check if this emitter has `event` handlers.
     *
     * @param {String} event
     * @return {Boolean}
     * @api public
     */

    Emitter.prototype.hasListeners = function(event){
      return !! this.listeners(event).length;
    };

    const PACKET_TYPES = Object.create(null); // no Map = no polyfill
    PACKET_TYPES["open"] = "0";
    PACKET_TYPES["close"] = "1";
    PACKET_TYPES["ping"] = "2";
    PACKET_TYPES["pong"] = "3";
    PACKET_TYPES["message"] = "4";
    PACKET_TYPES["upgrade"] = "5";
    PACKET_TYPES["noop"] = "6";
    const PACKET_TYPES_REVERSE = Object.create(null);
    Object.keys(PACKET_TYPES).forEach(key => {
        PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
    });
    const ERROR_PACKET = { type: "error", data: "parser error" };

    const withNativeBlob$1 = typeof Blob === "function" ||
        (typeof Blob !== "undefined" &&
            Object.prototype.toString.call(Blob) === "[object BlobConstructor]");
    const withNativeArrayBuffer$2 = typeof ArrayBuffer === "function";
    // ArrayBuffer.isView method is not defined in IE10
    const isView$1 = obj => {
        return typeof ArrayBuffer.isView === "function"
            ? ArrayBuffer.isView(obj)
            : obj && obj.buffer instanceof ArrayBuffer;
    };
    const encodePacket = ({ type, data }, supportsBinary, callback) => {
        if (withNativeBlob$1 && data instanceof Blob) {
            if (supportsBinary) {
                return callback(data);
            }
            else {
                return encodeBlobAsBase64(data, callback);
            }
        }
        else if (withNativeArrayBuffer$2 &&
            (data instanceof ArrayBuffer || isView$1(data))) {
            if (supportsBinary) {
                return callback(data);
            }
            else {
                return encodeBlobAsBase64(new Blob([data]), callback);
            }
        }
        // plain string
        return callback(PACKET_TYPES[type] + (data || ""));
    };
    const encodeBlobAsBase64 = (data, callback) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const content = fileReader.result.split(",")[1];
            callback("b" + content);
        };
        return fileReader.readAsDataURL(data);
    };

    /*
     * base64-arraybuffer 1.0.1 <https://github.com/niklasvh/base64-arraybuffer>
     * Copyright (c) 2022 Niklas von Hertzen <https://hertzen.com>
     * Released under MIT License
     */
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    // Use a lookup table to find the index.
    var lookup$1 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
    for (var i$1 = 0; i$1 < chars.length; i$1++) {
        lookup$1[chars.charCodeAt(i$1)] = i$1;
    }
    var decode$2 = function (base64) {
        var bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
        if (base64[base64.length - 1] === '=') {
            bufferLength--;
            if (base64[base64.length - 2] === '=') {
                bufferLength--;
            }
        }
        var arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
        for (i = 0; i < len; i += 4) {
            encoded1 = lookup$1[base64.charCodeAt(i)];
            encoded2 = lookup$1[base64.charCodeAt(i + 1)];
            encoded3 = lookup$1[base64.charCodeAt(i + 2)];
            encoded4 = lookup$1[base64.charCodeAt(i + 3)];
            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }
        return arraybuffer;
    };

    const withNativeArrayBuffer$1 = typeof ArrayBuffer === "function";
    const decodePacket = (encodedPacket, binaryType) => {
        if (typeof encodedPacket !== "string") {
            return {
                type: "message",
                data: mapBinary(encodedPacket, binaryType)
            };
        }
        const type = encodedPacket.charAt(0);
        if (type === "b") {
            return {
                type: "message",
                data: decodeBase64Packet(encodedPacket.substring(1), binaryType)
            };
        }
        const packetType = PACKET_TYPES_REVERSE[type];
        if (!packetType) {
            return ERROR_PACKET;
        }
        return encodedPacket.length > 1
            ? {
                type: PACKET_TYPES_REVERSE[type],
                data: encodedPacket.substring(1)
            }
            : {
                type: PACKET_TYPES_REVERSE[type]
            };
    };
    const decodeBase64Packet = (data, binaryType) => {
        if (withNativeArrayBuffer$1) {
            const decoded = decode$2(data);
            return mapBinary(decoded, binaryType);
        }
        else {
            return { base64: true, data }; // fallback for old browsers
        }
    };
    const mapBinary = (data, binaryType) => {
        switch (binaryType) {
            case "blob":
                return data instanceof ArrayBuffer ? new Blob([data]) : data;
            case "arraybuffer":
            default:
                return data; // assuming the data is already an ArrayBuffer
        }
    };

    const SEPARATOR = String.fromCharCode(30); // see https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text
    const encodePayload = (packets, callback) => {
        // some packets may be added to the array while encoding, so the initial length must be saved
        const length = packets.length;
        const encodedPackets = new Array(length);
        let count = 0;
        packets.forEach((packet, i) => {
            // force base64 encoding for binary packets
            encodePacket(packet, false, encodedPacket => {
                encodedPackets[i] = encodedPacket;
                if (++count === length) {
                    callback(encodedPackets.join(SEPARATOR));
                }
            });
        });
    };
    const decodePayload = (encodedPayload, binaryType) => {
        const encodedPackets = encodedPayload.split(SEPARATOR);
        const packets = [];
        for (let i = 0; i < encodedPackets.length; i++) {
            const decodedPacket = decodePacket(encodedPackets[i], binaryType);
            packets.push(decodedPacket);
            if (decodedPacket.type === "error") {
                break;
            }
        }
        return packets;
    };
    const protocol$1 = 4;

    class Transport extends Emitter_1 {
        /**
         * Transport abstract constructor.
         *
         * @param {Object} options.
         * @api private
         */
        constructor(opts) {
            super();
            this.writable = false;
            installTimerFunctions(this, opts);
            this.opts = opts;
            this.query = opts.query;
            this.readyState = "";
            this.socket = opts.socket;
        }
        /**
         * Emits an error.
         *
         * @param {String} str
         * @return {Transport} for chaining
         * @api protected
         */
        onError(msg, desc) {
            const err = new Error(msg);
            // @ts-ignore
            err.type = "TransportError";
            // @ts-ignore
            err.description = desc;
            super.emit("error", err);
            return this;
        }
        /**
         * Opens the transport.
         *
         * @api public
         */
        open() {
            if ("closed" === this.readyState || "" === this.readyState) {
                this.readyState = "opening";
                this.doOpen();
            }
            return this;
        }
        /**
         * Closes the transport.
         *
         * @api public
         */
        close() {
            if ("opening" === this.readyState || "open" === this.readyState) {
                this.doClose();
                this.onClose();
            }
            return this;
        }
        /**
         * Sends multiple packets.
         *
         * @param {Array} packets
         * @api public
         */
        send(packets) {
            if ("open" === this.readyState) {
                this.write(packets);
            }
        }
        /**
         * Called upon open
         *
         * @api protected
         */
        onOpen() {
            this.readyState = "open";
            this.writable = true;
            super.emit("open");
        }
        /**
         * Called with data.
         *
         * @param {String} data
         * @api protected
         */
        onData(data) {
            const packet = decodePacket(data, this.socket.binaryType);
            this.onPacket(packet);
        }
        /**
         * Called with a decoded packet.
         *
         * @api protected
         */
        onPacket(packet) {
            super.emit("packet", packet);
        }
        /**
         * Called upon close.
         *
         * @api protected
         */
        onClose() {
            this.readyState = "closed";
            super.emit("close");
        }
    }

    var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split('')
      , length = 64
      , map = {}
      , seed = 0
      , i = 0
      , prev;

    /**
     * Return a string representing the specified number.
     *
     * @param {Number} num The number to convert.
     * @returns {String} The string representation of the number.
     * @api public
     */
    function encode$1(num) {
      var encoded = '';

      do {
        encoded = alphabet[num % length] + encoded;
        num = Math.floor(num / length);
      } while (num > 0);

      return encoded;
    }

    /**
     * Return the integer value specified by the given string.
     *
     * @param {String} str The string to convert.
     * @returns {Number} The integer value represented by the string.
     * @api public
     */
    function decode$1(str) {
      var decoded = 0;

      for (i = 0; i < str.length; i++) {
        decoded = decoded * length + map[str.charAt(i)];
      }

      return decoded;
    }

    /**
     * Yeast: A tiny growing id generator.
     *
     * @returns {String} A unique id.
     * @api public
     */
    function yeast() {
      var now = encode$1(+new Date());

      if (now !== prev) return seed = 0, prev = now;
      return now +'.'+ encode$1(seed++);
    }

    //
    // Map each character to its index.
    //
    for (; i < length; i++) map[alphabet[i]] = i;

    //
    // Expose the `yeast`, `encode` and `decode` functions.
    //
    yeast.encode = encode$1;
    yeast.decode = decode$1;
    var yeast_1 = yeast;

    /**
     * Compiles a querystring
     * Returns string representation of the object
     *
     * @param {Object}
     * @api private
     */
    var encode = function (obj) {
      var str = '';

      for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
          if (str.length) str += '&';
          str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
        }
      }

      return str;
    };

    /**
     * Parses a simple querystring into an object
     *
     * @param {String} qs
     * @api private
     */

    var decode = function(qs){
      var qry = {};
      var pairs = qs.split('&');
      for (var i = 0, l = pairs.length; i < l; i++) {
        var pair = pairs[i].split('=');
        qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
      }
      return qry;
    };

    var parseqs = {
    	encode: encode,
    	decode: decode
    };

    class Polling extends Transport {
        constructor() {
            super(...arguments);
            this.polling = false;
        }
        /**
         * Transport name.
         */
        get name() {
            return "polling";
        }
        /**
         * Opens the socket (triggers polling). We write a PING message to determine
         * when the transport is open.
         *
         * @api private
         */
        doOpen() {
            this.poll();
        }
        /**
         * Pauses polling.
         *
         * @param {Function} callback upon buffers are flushed and transport is paused
         * @api private
         */
        pause(onPause) {
            this.readyState = "pausing";
            const pause = () => {
                this.readyState = "paused";
                onPause();
            };
            if (this.polling || !this.writable) {
                let total = 0;
                if (this.polling) {
                    total++;
                    this.once("pollComplete", function () {
                        --total || pause();
                    });
                }
                if (!this.writable) {
                    total++;
                    this.once("drain", function () {
                        --total || pause();
                    });
                }
            }
            else {
                pause();
            }
        }
        /**
         * Starts polling cycle.
         *
         * @api public
         */
        poll() {
            this.polling = true;
            this.doPoll();
            this.emit("poll");
        }
        /**
         * Overloads onData to detect payloads.
         *
         * @api private
         */
        onData(data) {
            const callback = packet => {
                // if its the first message we consider the transport open
                if ("opening" === this.readyState && packet.type === "open") {
                    this.onOpen();
                }
                // if its a close packet, we close the ongoing requests
                if ("close" === packet.type) {
                    this.onClose();
                    return false;
                }
                // otherwise bypass onData and handle the message
                this.onPacket(packet);
            };
            // decode payload
            decodePayload(data, this.socket.binaryType).forEach(callback);
            // if an event did not trigger closing
            if ("closed" !== this.readyState) {
                // if we got data we're not polling
                this.polling = false;
                this.emit("pollComplete");
                if ("open" === this.readyState) {
                    this.poll();
                }
            }
        }
        /**
         * For polling, send a close packet.
         *
         * @api private
         */
        doClose() {
            const close = () => {
                this.write([{ type: "close" }]);
            };
            if ("open" === this.readyState) {
                close();
            }
            else {
                // in case we're trying to close while
                // handshaking is in progress (GH-164)
                this.once("open", close);
            }
        }
        /**
         * Writes a packets payload.
         *
         * @param {Array} data packets
         * @param {Function} drain callback
         * @api private
         */
        write(packets) {
            this.writable = false;
            encodePayload(packets, data => {
                this.doWrite(data, () => {
                    this.writable = true;
                    this.emit("drain");
                });
            });
        }
        /**
         * Generates uri for connection.
         *
         * @api private
         */
        uri() {
            let query = this.query || {};
            const schema = this.opts.secure ? "https" : "http";
            let port = "";
            // cache busting is forced
            if (false !== this.opts.timestampRequests) {
                query[this.opts.timestampParam] = yeast_1();
            }
            if (!this.supportsBinary && !query.sid) {
                query.b64 = 1;
            }
            // avoid port if default for schema
            if (this.opts.port &&
                (("https" === schema && Number(this.opts.port) !== 443) ||
                    ("http" === schema && Number(this.opts.port) !== 80))) {
                port = ":" + this.opts.port;
            }
            const encodedQuery = parseqs.encode(query);
            const ipv6 = this.opts.hostname.indexOf(":") !== -1;
            return (schema +
                "://" +
                (ipv6 ? "[" + this.opts.hostname + "]" : this.opts.hostname) +
                port +
                this.opts.path +
                (encodedQuery.length ? "?" + encodedQuery : ""));
        }
    }

    /* global attachEvent */
    /**
     * Empty function
     */
    function empty() { }
    const hasXHR2 = (function () {
        const xhr = new XMLHttpRequest$1({
            xdomain: false
        });
        return null != xhr.responseType;
    })();
    class XHR extends Polling {
        /**
         * XHR Polling constructor.
         *
         * @param {Object} opts
         * @api public
         */
        constructor(opts) {
            super(opts);
            if (typeof location !== "undefined") {
                const isSSL = "https:" === location.protocol;
                let port = location.port;
                // some user agents have empty `location.port`
                if (!port) {
                    port = isSSL ? "443" : "80";
                }
                this.xd =
                    (typeof location !== "undefined" &&
                        opts.hostname !== location.hostname) ||
                        port !== opts.port;
                this.xs = opts.secure !== isSSL;
            }
            /**
             * XHR supports binary
             */
            const forceBase64 = opts && opts.forceBase64;
            this.supportsBinary = hasXHR2 && !forceBase64;
        }
        /**
         * Creates a request.
         *
         * @param {String} method
         * @api private
         */
        request(opts = {}) {
            Object.assign(opts, { xd: this.xd, xs: this.xs }, this.opts);
            return new Request(this.uri(), opts);
        }
        /**
         * Sends data.
         *
         * @param {String} data to send.
         * @param {Function} called upon flush.
         * @api private
         */
        doWrite(data, fn) {
            const req = this.request({
                method: "POST",
                data: data
            });
            req.on("success", fn);
            req.on("error", err => {
                this.onError("xhr post error", err);
            });
        }
        /**
         * Starts a poll cycle.
         *
         * @api private
         */
        doPoll() {
            const req = this.request();
            req.on("data", this.onData.bind(this));
            req.on("error", err => {
                this.onError("xhr poll error", err);
            });
            this.pollXhr = req;
        }
    }
    class Request extends Emitter_1 {
        /**
         * Request constructor
         *
         * @param {Object} options
         * @api public
         */
        constructor(uri, opts) {
            super();
            installTimerFunctions(this, opts);
            this.opts = opts;
            this.method = opts.method || "GET";
            this.uri = uri;
            this.async = false !== opts.async;
            this.data = undefined !== opts.data ? opts.data : null;
            this.create();
        }
        /**
         * Creates the XHR object and sends the request.
         *
         * @api private
         */
        create() {
            const opts = pick(this.opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
            opts.xdomain = !!this.opts.xd;
            opts.xscheme = !!this.opts.xs;
            const xhr = (this.xhr = new XMLHttpRequest$1(opts));
            try {
                xhr.open(this.method, this.uri, this.async);
                try {
                    if (this.opts.extraHeaders) {
                        xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
                        for (let i in this.opts.extraHeaders) {
                            if (this.opts.extraHeaders.hasOwnProperty(i)) {
                                xhr.setRequestHeader(i, this.opts.extraHeaders[i]);
                            }
                        }
                    }
                }
                catch (e) { }
                if ("POST" === this.method) {
                    try {
                        xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
                    }
                    catch (e) { }
                }
                try {
                    xhr.setRequestHeader("Accept", "*/*");
                }
                catch (e) { }
                // ie6 check
                if ("withCredentials" in xhr) {
                    xhr.withCredentials = this.opts.withCredentials;
                }
                if (this.opts.requestTimeout) {
                    xhr.timeout = this.opts.requestTimeout;
                }
                xhr.onreadystatechange = () => {
                    if (4 !== xhr.readyState)
                        return;
                    if (200 === xhr.status || 1223 === xhr.status) {
                        this.onLoad();
                    }
                    else {
                        // make sure the `error` event handler that's user-set
                        // does not throw in the same tick and gets caught here
                        this.setTimeoutFn(() => {
                            this.onError(typeof xhr.status === "number" ? xhr.status : 0);
                        }, 0);
                    }
                };
                xhr.send(this.data);
            }
            catch (e) {
                // Need to defer since .create() is called directly from the constructor
                // and thus the 'error' event can only be only bound *after* this exception
                // occurs.  Therefore, also, we cannot throw here at all.
                this.setTimeoutFn(() => {
                    this.onError(e);
                }, 0);
                return;
            }
            if (typeof document !== "undefined") {
                this.index = Request.requestsCount++;
                Request.requests[this.index] = this;
            }
        }
        /**
         * Called upon successful response.
         *
         * @api private
         */
        onSuccess() {
            this.emit("success");
            this.cleanup();
        }
        /**
         * Called if we have data.
         *
         * @api private
         */
        onData(data) {
            this.emit("data", data);
            this.onSuccess();
        }
        /**
         * Called upon error.
         *
         * @api private
         */
        onError(err) {
            this.emit("error", err);
            this.cleanup(true);
        }
        /**
         * Cleans up house.
         *
         * @api private
         */
        cleanup(fromError) {
            if ("undefined" === typeof this.xhr || null === this.xhr) {
                return;
            }
            this.xhr.onreadystatechange = empty;
            if (fromError) {
                try {
                    this.xhr.abort();
                }
                catch (e) { }
            }
            if (typeof document !== "undefined") {
                delete Request.requests[this.index];
            }
            this.xhr = null;
        }
        /**
         * Called upon load.
         *
         * @api private
         */
        onLoad() {
            const data = this.xhr.responseText;
            if (data !== null) {
                this.onData(data);
            }
        }
        /**
         * Aborts the request.
         *
         * @api public
         */
        abort() {
            this.cleanup();
        }
    }
    Request.requestsCount = 0;
    Request.requests = {};
    /**
     * Aborts pending requests when unloading the window. This is needed to prevent
     * memory leaks (e.g. when using IE) and to ensure that no spurious error is
     * emitted.
     */
    if (typeof document !== "undefined") {
        // @ts-ignore
        if (typeof attachEvent === "function") {
            // @ts-ignore
            attachEvent("onunload", unloadHandler);
        }
        else if (typeof addEventListener === "function") {
            const terminationEvent = "onpagehide" in globalThis$1 ? "pagehide" : "unload";
            addEventListener(terminationEvent, unloadHandler, false);
        }
    }
    function unloadHandler() {
        for (let i in Request.requests) {
            if (Request.requests.hasOwnProperty(i)) {
                Request.requests[i].abort();
            }
        }
    }

    const nextTick = (() => {
        const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
        if (isPromiseAvailable) {
            return cb => Promise.resolve().then(cb);
        }
        else {
            return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
        }
    })();
    const WebSocket = globalThis$1.WebSocket || globalThis$1.MozWebSocket;
    const usingBrowserWebSocket = true;
    const defaultBinaryType = "arraybuffer";

    // detect ReactNative environment
    const isReactNative = typeof navigator !== "undefined" &&
        typeof navigator.product === "string" &&
        navigator.product.toLowerCase() === "reactnative";
    class WS extends Transport {
        /**
         * WebSocket transport constructor.
         *
         * @api {Object} connection options
         * @api public
         */
        constructor(opts) {
            super(opts);
            this.supportsBinary = !opts.forceBase64;
        }
        /**
         * Transport name.
         *
         * @api public
         */
        get name() {
            return "websocket";
        }
        /**
         * Opens socket.
         *
         * @api private
         */
        doOpen() {
            if (!this.check()) {
                // let probe timeout
                return;
            }
            const uri = this.uri();
            const protocols = this.opts.protocols;
            // React Native only supports the 'headers' option, and will print a warning if anything else is passed
            const opts = isReactNative
                ? {}
                : pick(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
            if (this.opts.extraHeaders) {
                opts.headers = this.opts.extraHeaders;
            }
            try {
                this.ws =
                    usingBrowserWebSocket && !isReactNative
                        ? protocols
                            ? new WebSocket(uri, protocols)
                            : new WebSocket(uri)
                        : new WebSocket(uri, protocols, opts);
            }
            catch (err) {
                return this.emit("error", err);
            }
            this.ws.binaryType = this.socket.binaryType || defaultBinaryType;
            this.addEventListeners();
        }
        /**
         * Adds event listeners to the socket
         *
         * @api private
         */
        addEventListeners() {
            this.ws.onopen = () => {
                if (this.opts.autoUnref) {
                    this.ws._socket.unref();
                }
                this.onOpen();
            };
            this.ws.onclose = this.onClose.bind(this);
            this.ws.onmessage = ev => this.onData(ev.data);
            this.ws.onerror = e => this.onError("websocket error", e);
        }
        /**
         * Writes data to socket.
         *
         * @param {Array} array of packets.
         * @api private
         */
        write(packets) {
            this.writable = false;
            // encodePacket efficient as it uses WS framing
            // no need for encodePayload
            for (let i = 0; i < packets.length; i++) {
                const packet = packets[i];
                const lastPacket = i === packets.length - 1;
                encodePacket(packet, this.supportsBinary, data => {
                    // always create a new object (GH-437)
                    const opts = {};
                    // Sometimes the websocket has already been closed but the browser didn't
                    // have a chance of informing us about it yet, in that case send will
                    // throw an error
                    try {
                        if (usingBrowserWebSocket) {
                            // TypeError is thrown when passing the second argument on Safari
                            this.ws.send(data);
                        }
                    }
                    catch (e) {
                    }
                    if (lastPacket) {
                        // fake drain
                        // defer to next tick to allow Socket to clear writeBuffer
                        nextTick(() => {
                            this.writable = true;
                            this.emit("drain");
                        }, this.setTimeoutFn);
                    }
                });
            }
        }
        /**
         * Closes socket.
         *
         * @api private
         */
        doClose() {
            if (typeof this.ws !== "undefined") {
                this.ws.close();
                this.ws = null;
            }
        }
        /**
         * Generates uri for connection.
         *
         * @api private
         */
        uri() {
            let query = this.query || {};
            const schema = this.opts.secure ? "wss" : "ws";
            let port = "";
            // avoid port if default for schema
            if (this.opts.port &&
                (("wss" === schema && Number(this.opts.port) !== 443) ||
                    ("ws" === schema && Number(this.opts.port) !== 80))) {
                port = ":" + this.opts.port;
            }
            // append timestamp to URI
            if (this.opts.timestampRequests) {
                query[this.opts.timestampParam] = yeast_1();
            }
            // communicate binary support capabilities
            if (!this.supportsBinary) {
                query.b64 = 1;
            }
            const encodedQuery = parseqs.encode(query);
            const ipv6 = this.opts.hostname.indexOf(":") !== -1;
            return (schema +
                "://" +
                (ipv6 ? "[" + this.opts.hostname + "]" : this.opts.hostname) +
                port +
                this.opts.path +
                (encodedQuery.length ? "?" + encodedQuery : ""));
        }
        /**
         * Feature detection for WebSocket.
         *
         * @return {Boolean} whether this transport is available.
         * @api public
         */
        check() {
            return (!!WebSocket &&
                !("__initialize" in WebSocket && this.name === WS.prototype.name));
        }
    }

    const transports = {
        websocket: WS,
        polling: XHR
    };

    class Socket$1 extends Emitter_1 {
        /**
         * Socket constructor.
         *
         * @param {String|Object} uri or options
         * @param {Object} opts - options
         * @api public
         */
        constructor(uri, opts = {}) {
            super();
            if (uri && "object" === typeof uri) {
                opts = uri;
                uri = null;
            }
            if (uri) {
                uri = parseuri(uri);
                opts.hostname = uri.host;
                opts.secure = uri.protocol === "https" || uri.protocol === "wss";
                opts.port = uri.port;
                if (uri.query)
                    opts.query = uri.query;
            }
            else if (opts.host) {
                opts.hostname = parseuri(opts.host).host;
            }
            installTimerFunctions(this, opts);
            this.secure =
                null != opts.secure
                    ? opts.secure
                    : typeof location !== "undefined" && "https:" === location.protocol;
            if (opts.hostname && !opts.port) {
                // if no port is specified manually, use the protocol default
                opts.port = this.secure ? "443" : "80";
            }
            this.hostname =
                opts.hostname ||
                    (typeof location !== "undefined" ? location.hostname : "localhost");
            this.port =
                opts.port ||
                    (typeof location !== "undefined" && location.port
                        ? location.port
                        : this.secure
                            ? "443"
                            : "80");
            this.transports = opts.transports || ["polling", "websocket"];
            this.readyState = "";
            this.writeBuffer = [];
            this.prevBufferLen = 0;
            this.opts = Object.assign({
                path: "/engine.io",
                agent: false,
                withCredentials: false,
                upgrade: true,
                timestampParam: "t",
                rememberUpgrade: false,
                rejectUnauthorized: true,
                perMessageDeflate: {
                    threshold: 1024
                },
                transportOptions: {},
                closeOnBeforeunload: true
            }, opts);
            this.opts.path = this.opts.path.replace(/\/$/, "") + "/";
            if (typeof this.opts.query === "string") {
                this.opts.query = parseqs.decode(this.opts.query);
            }
            // set on handshake
            this.id = null;
            this.upgrades = null;
            this.pingInterval = null;
            this.pingTimeout = null;
            // set on heartbeat
            this.pingTimeoutTimer = null;
            if (typeof addEventListener === "function") {
                if (this.opts.closeOnBeforeunload) {
                    // Firefox closes the connection when the "beforeunload" event is emitted but not Chrome. This event listener
                    // ensures every browser behaves the same (no "disconnect" event at the Socket.IO level when the page is
                    // closed/reloaded)
                    addEventListener("beforeunload", () => {
                        if (this.transport) {
                            // silently close the transport
                            this.transport.removeAllListeners();
                            this.transport.close();
                        }
                    }, false);
                }
                if (this.hostname !== "localhost") {
                    this.offlineEventListener = () => {
                        this.onClose("transport close");
                    };
                    addEventListener("offline", this.offlineEventListener, false);
                }
            }
            this.open();
        }
        /**
         * Creates transport of the given type.
         *
         * @param {String} transport name
         * @return {Transport}
         * @api private
         */
        createTransport(name) {
            const query = clone(this.opts.query);
            // append engine.io protocol identifier
            query.EIO = protocol$1;
            // transport name
            query.transport = name;
            // session id if we already have one
            if (this.id)
                query.sid = this.id;
            const opts = Object.assign({}, this.opts.transportOptions[name], this.opts, {
                query,
                socket: this,
                hostname: this.hostname,
                secure: this.secure,
                port: this.port
            });
            return new transports[name](opts);
        }
        /**
         * Initializes transport to use and starts probe.
         *
         * @api private
         */
        open() {
            let transport;
            if (this.opts.rememberUpgrade &&
                Socket$1.priorWebsocketSuccess &&
                this.transports.indexOf("websocket") !== -1) {
                transport = "websocket";
            }
            else if (0 === this.transports.length) {
                // Emit error on next tick so it can be listened to
                this.setTimeoutFn(() => {
                    this.emitReserved("error", "No transports available");
                }, 0);
                return;
            }
            else {
                transport = this.transports[0];
            }
            this.readyState = "opening";
            // Retry with the next transport if the transport is disabled (jsonp: false)
            try {
                transport = this.createTransport(transport);
            }
            catch (e) {
                this.transports.shift();
                this.open();
                return;
            }
            transport.open();
            this.setTransport(transport);
        }
        /**
         * Sets the current transport. Disables the existing one (if any).
         *
         * @api private
         */
        setTransport(transport) {
            if (this.transport) {
                this.transport.removeAllListeners();
            }
            // set up transport
            this.transport = transport;
            // set up transport listeners
            transport
                .on("drain", this.onDrain.bind(this))
                .on("packet", this.onPacket.bind(this))
                .on("error", this.onError.bind(this))
                .on("close", () => {
                this.onClose("transport close");
            });
        }
        /**
         * Probes a transport.
         *
         * @param {String} transport name
         * @api private
         */
        probe(name) {
            let transport = this.createTransport(name);
            let failed = false;
            Socket$1.priorWebsocketSuccess = false;
            const onTransportOpen = () => {
                if (failed)
                    return;
                transport.send([{ type: "ping", data: "probe" }]);
                transport.once("packet", msg => {
                    if (failed)
                        return;
                    if ("pong" === msg.type && "probe" === msg.data) {
                        this.upgrading = true;
                        this.emitReserved("upgrading", transport);
                        if (!transport)
                            return;
                        Socket$1.priorWebsocketSuccess = "websocket" === transport.name;
                        this.transport.pause(() => {
                            if (failed)
                                return;
                            if ("closed" === this.readyState)
                                return;
                            cleanup();
                            this.setTransport(transport);
                            transport.send([{ type: "upgrade" }]);
                            this.emitReserved("upgrade", transport);
                            transport = null;
                            this.upgrading = false;
                            this.flush();
                        });
                    }
                    else {
                        const err = new Error("probe error");
                        // @ts-ignore
                        err.transport = transport.name;
                        this.emitReserved("upgradeError", err);
                    }
                });
            };
            function freezeTransport() {
                if (failed)
                    return;
                // Any callback called by transport should be ignored since now
                failed = true;
                cleanup();
                transport.close();
                transport = null;
            }
            // Handle any error that happens while probing
            const onerror = err => {
                const error = new Error("probe error: " + err);
                // @ts-ignore
                error.transport = transport.name;
                freezeTransport();
                this.emitReserved("upgradeError", error);
            };
            function onTransportClose() {
                onerror("transport closed");
            }
            // When the socket is closed while we're probing
            function onclose() {
                onerror("socket closed");
            }
            // When the socket is upgraded while we're probing
            function onupgrade(to) {
                if (transport && to.name !== transport.name) {
                    freezeTransport();
                }
            }
            // Remove all listeners on the transport and on self
            const cleanup = () => {
                transport.removeListener("open", onTransportOpen);
                transport.removeListener("error", onerror);
                transport.removeListener("close", onTransportClose);
                this.off("close", onclose);
                this.off("upgrading", onupgrade);
            };
            transport.once("open", onTransportOpen);
            transport.once("error", onerror);
            transport.once("close", onTransportClose);
            this.once("close", onclose);
            this.once("upgrading", onupgrade);
            transport.open();
        }
        /**
         * Called when connection is deemed open.
         *
         * @api private
         */
        onOpen() {
            this.readyState = "open";
            Socket$1.priorWebsocketSuccess = "websocket" === this.transport.name;
            this.emitReserved("open");
            this.flush();
            // we check for `readyState` in case an `open`
            // listener already closed the socket
            if ("open" === this.readyState &&
                this.opts.upgrade &&
                this.transport.pause) {
                let i = 0;
                const l = this.upgrades.length;
                for (; i < l; i++) {
                    this.probe(this.upgrades[i]);
                }
            }
        }
        /**
         * Handles a packet.
         *
         * @api private
         */
        onPacket(packet) {
            if ("opening" === this.readyState ||
                "open" === this.readyState ||
                "closing" === this.readyState) {
                this.emitReserved("packet", packet);
                // Socket is live - any packet counts
                this.emitReserved("heartbeat");
                switch (packet.type) {
                    case "open":
                        this.onHandshake(JSON.parse(packet.data));
                        break;
                    case "ping":
                        this.resetPingTimeout();
                        this.sendPacket("pong");
                        this.emitReserved("ping");
                        this.emitReserved("pong");
                        break;
                    case "error":
                        const err = new Error("server error");
                        // @ts-ignore
                        err.code = packet.data;
                        this.onError(err);
                        break;
                    case "message":
                        this.emitReserved("data", packet.data);
                        this.emitReserved("message", packet.data);
                        break;
                }
            }
        }
        /**
         * Called upon handshake completion.
         *
         * @param {Object} data - handshake obj
         * @api private
         */
        onHandshake(data) {
            this.emitReserved("handshake", data);
            this.id = data.sid;
            this.transport.query.sid = data.sid;
            this.upgrades = this.filterUpgrades(data.upgrades);
            this.pingInterval = data.pingInterval;
            this.pingTimeout = data.pingTimeout;
            this.onOpen();
            // In case open handler closes socket
            if ("closed" === this.readyState)
                return;
            this.resetPingTimeout();
        }
        /**
         * Sets and resets ping timeout timer based on server pings.
         *
         * @api private
         */
        resetPingTimeout() {
            this.clearTimeoutFn(this.pingTimeoutTimer);
            this.pingTimeoutTimer = this.setTimeoutFn(() => {
                this.onClose("ping timeout");
            }, this.pingInterval + this.pingTimeout);
            if (this.opts.autoUnref) {
                this.pingTimeoutTimer.unref();
            }
        }
        /**
         * Called on `drain` event
         *
         * @api private
         */
        onDrain() {
            this.writeBuffer.splice(0, this.prevBufferLen);
            // setting prevBufferLen = 0 is very important
            // for example, when upgrading, upgrade packet is sent over,
            // and a nonzero prevBufferLen could cause problems on `drain`
            this.prevBufferLen = 0;
            if (0 === this.writeBuffer.length) {
                this.emitReserved("drain");
            }
            else {
                this.flush();
            }
        }
        /**
         * Flush write buffers.
         *
         * @api private
         */
        flush() {
            if ("closed" !== this.readyState &&
                this.transport.writable &&
                !this.upgrading &&
                this.writeBuffer.length) {
                this.transport.send(this.writeBuffer);
                // keep track of current length of writeBuffer
                // splice writeBuffer and callbackBuffer on `drain`
                this.prevBufferLen = this.writeBuffer.length;
                this.emitReserved("flush");
            }
        }
        /**
         * Sends a message.
         *
         * @param {String} message.
         * @param {Function} callback function.
         * @param {Object} options.
         * @return {Socket} for chaining.
         * @api public
         */
        write(msg, options, fn) {
            this.sendPacket("message", msg, options, fn);
            return this;
        }
        send(msg, options, fn) {
            this.sendPacket("message", msg, options, fn);
            return this;
        }
        /**
         * Sends a packet.
         *
         * @param {String} packet type.
         * @param {String} data.
         * @param {Object} options.
         * @param {Function} callback function.
         * @api private
         */
        sendPacket(type, data, options, fn) {
            if ("function" === typeof data) {
                fn = data;
                data = undefined;
            }
            if ("function" === typeof options) {
                fn = options;
                options = null;
            }
            if ("closing" === this.readyState || "closed" === this.readyState) {
                return;
            }
            options = options || {};
            options.compress = false !== options.compress;
            const packet = {
                type: type,
                data: data,
                options: options
            };
            this.emitReserved("packetCreate", packet);
            this.writeBuffer.push(packet);
            if (fn)
                this.once("flush", fn);
            this.flush();
        }
        /**
         * Closes the connection.
         *
         * @api public
         */
        close() {
            const close = () => {
                this.onClose("forced close");
                this.transport.close();
            };
            const cleanupAndClose = () => {
                this.off("upgrade", cleanupAndClose);
                this.off("upgradeError", cleanupAndClose);
                close();
            };
            const waitForUpgrade = () => {
                // wait for upgrade to finish since we can't send packets while pausing a transport
                this.once("upgrade", cleanupAndClose);
                this.once("upgradeError", cleanupAndClose);
            };
            if ("opening" === this.readyState || "open" === this.readyState) {
                this.readyState = "closing";
                if (this.writeBuffer.length) {
                    this.once("drain", () => {
                        if (this.upgrading) {
                            waitForUpgrade();
                        }
                        else {
                            close();
                        }
                    });
                }
                else if (this.upgrading) {
                    waitForUpgrade();
                }
                else {
                    close();
                }
            }
            return this;
        }
        /**
         * Called upon transport error
         *
         * @api private
         */
        onError(err) {
            Socket$1.priorWebsocketSuccess = false;
            this.emitReserved("error", err);
            this.onClose("transport error", err);
        }
        /**
         * Called upon transport close.
         *
         * @api private
         */
        onClose(reason, desc) {
            if ("opening" === this.readyState ||
                "open" === this.readyState ||
                "closing" === this.readyState) {
                // clear timers
                this.clearTimeoutFn(this.pingTimeoutTimer);
                // stop event from firing again for transport
                this.transport.removeAllListeners("close");
                // ensure transport won't stay open
                this.transport.close();
                // ignore further transport communication
                this.transport.removeAllListeners();
                if (typeof removeEventListener === "function") {
                    removeEventListener("offline", this.offlineEventListener, false);
                }
                // set ready state
                this.readyState = "closed";
                // clear session id
                this.id = null;
                // emit close event
                this.emitReserved("close", reason, desc);
                // clean buffers after, so users can still
                // grab the buffers on `close` event
                this.writeBuffer = [];
                this.prevBufferLen = 0;
            }
        }
        /**
         * Filters upgrades, returning only those matching client transports.
         *
         * @param {Array} server upgrades
         * @api private
         *
         */
        filterUpgrades(upgrades) {
            const filteredUpgrades = [];
            let i = 0;
            const j = upgrades.length;
            for (; i < j; i++) {
                if (~this.transports.indexOf(upgrades[i]))
                    filteredUpgrades.push(upgrades[i]);
            }
            return filteredUpgrades;
        }
    }
    Socket$1.protocol = protocol$1;
    function clone(obj) {
        const o = {};
        for (let i in obj) {
            if (obj.hasOwnProperty(i)) {
                o[i] = obj[i];
            }
        }
        return o;
    }

    const withNativeArrayBuffer = typeof ArrayBuffer === "function";
    const isView = (obj) => {
        return typeof ArrayBuffer.isView === "function"
            ? ArrayBuffer.isView(obj)
            : obj.buffer instanceof ArrayBuffer;
    };
    const toString = Object.prototype.toString;
    const withNativeBlob = typeof Blob === "function" ||
        (typeof Blob !== "undefined" &&
            toString.call(Blob) === "[object BlobConstructor]");
    const withNativeFile = typeof File === "function" ||
        (typeof File !== "undefined" &&
            toString.call(File) === "[object FileConstructor]");
    /**
     * Returns true if obj is a Buffer, an ArrayBuffer, a Blob or a File.
     *
     * @private
     */
    function isBinary(obj) {
        return ((withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj))) ||
            (withNativeBlob && obj instanceof Blob) ||
            (withNativeFile && obj instanceof File));
    }
    function hasBinary(obj, toJSON) {
        if (!obj || typeof obj !== "object") {
            return false;
        }
        if (Array.isArray(obj)) {
            for (let i = 0, l = obj.length; i < l; i++) {
                if (hasBinary(obj[i])) {
                    return true;
                }
            }
            return false;
        }
        if (isBinary(obj)) {
            return true;
        }
        if (obj.toJSON &&
            typeof obj.toJSON === "function" &&
            arguments.length === 1) {
            return hasBinary(obj.toJSON(), true);
        }
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
                return true;
            }
        }
        return false;
    }

    /**
     * Replaces every Buffer | ArrayBuffer | Blob | File in packet with a numbered placeholder.
     *
     * @param {Object} packet - socket.io event packet
     * @return {Object} with deconstructed packet and list of buffers
     * @public
     */
    function deconstructPacket(packet) {
        const buffers = [];
        const packetData = packet.data;
        const pack = packet;
        pack.data = _deconstructPacket(packetData, buffers);
        pack.attachments = buffers.length; // number of binary 'attachments'
        return { packet: pack, buffers: buffers };
    }
    function _deconstructPacket(data, buffers) {
        if (!data)
            return data;
        if (isBinary(data)) {
            const placeholder = { _placeholder: true, num: buffers.length };
            buffers.push(data);
            return placeholder;
        }
        else if (Array.isArray(data)) {
            const newData = new Array(data.length);
            for (let i = 0; i < data.length; i++) {
                newData[i] = _deconstructPacket(data[i], buffers);
            }
            return newData;
        }
        else if (typeof data === "object" && !(data instanceof Date)) {
            const newData = {};
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    newData[key] = _deconstructPacket(data[key], buffers);
                }
            }
            return newData;
        }
        return data;
    }
    /**
     * Reconstructs a binary packet from its placeholder packet and buffers
     *
     * @param {Object} packet - event packet with placeholders
     * @param {Array} buffers - binary buffers to put in placeholder positions
     * @return {Object} reconstructed packet
     * @public
     */
    function reconstructPacket(packet, buffers) {
        packet.data = _reconstructPacket(packet.data, buffers);
        packet.attachments = undefined; // no longer useful
        return packet;
    }
    function _reconstructPacket(data, buffers) {
        if (!data)
            return data;
        if (data && data._placeholder) {
            return buffers[data.num]; // appropriate buffer (should be natural order anyway)
        }
        else if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                data[i] = _reconstructPacket(data[i], buffers);
            }
        }
        else if (typeof data === "object") {
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    data[key] = _reconstructPacket(data[key], buffers);
                }
            }
        }
        return data;
    }

    /**
     * Protocol version.
     *
     * @public
     */
    const protocol = 5;
    var PacketType;
    (function (PacketType) {
        PacketType[PacketType["CONNECT"] = 0] = "CONNECT";
        PacketType[PacketType["DISCONNECT"] = 1] = "DISCONNECT";
        PacketType[PacketType["EVENT"] = 2] = "EVENT";
        PacketType[PacketType["ACK"] = 3] = "ACK";
        PacketType[PacketType["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
        PacketType[PacketType["BINARY_EVENT"] = 5] = "BINARY_EVENT";
        PacketType[PacketType["BINARY_ACK"] = 6] = "BINARY_ACK";
    })(PacketType || (PacketType = {}));
    /**
     * A socket.io Encoder instance
     */
    class Encoder {
        /**
         * Encode a packet as a single string if non-binary, or as a
         * buffer sequence, depending on packet type.
         *
         * @param {Object} obj - packet object
         */
        encode(obj) {
            if (obj.type === PacketType.EVENT || obj.type === PacketType.ACK) {
                if (hasBinary(obj)) {
                    obj.type =
                        obj.type === PacketType.EVENT
                            ? PacketType.BINARY_EVENT
                            : PacketType.BINARY_ACK;
                    return this.encodeAsBinary(obj);
                }
            }
            return [this.encodeAsString(obj)];
        }
        /**
         * Encode packet as string.
         */
        encodeAsString(obj) {
            // first is type
            let str = "" + obj.type;
            // attachments if we have them
            if (obj.type === PacketType.BINARY_EVENT ||
                obj.type === PacketType.BINARY_ACK) {
                str += obj.attachments + "-";
            }
            // if we have a namespace other than `/`
            // we append it followed by a comma `,`
            if (obj.nsp && "/" !== obj.nsp) {
                str += obj.nsp + ",";
            }
            // immediately followed by the id
            if (null != obj.id) {
                str += obj.id;
            }
            // json data
            if (null != obj.data) {
                str += JSON.stringify(obj.data);
            }
            return str;
        }
        /**
         * Encode packet as 'buffer sequence' by removing blobs, and
         * deconstructing packet into object with placeholders and
         * a list of buffers.
         */
        encodeAsBinary(obj) {
            const deconstruction = deconstructPacket(obj);
            const pack = this.encodeAsString(deconstruction.packet);
            const buffers = deconstruction.buffers;
            buffers.unshift(pack); // add packet info to beginning of data list
            return buffers; // write all the buffers
        }
    }
    /**
     * A socket.io Decoder instance
     *
     * @return {Object} decoder
     */
    class Decoder extends Emitter_1 {
        constructor() {
            super();
        }
        /**
         * Decodes an encoded packet string into packet JSON.
         *
         * @param {String} obj - encoded packet
         */
        add(obj) {
            let packet;
            if (typeof obj === "string") {
                packet = this.decodeString(obj);
                if (packet.type === PacketType.BINARY_EVENT ||
                    packet.type === PacketType.BINARY_ACK) {
                    // binary packet's json
                    this.reconstructor = new BinaryReconstructor(packet);
                    // no attachments, labeled binary but no binary data to follow
                    if (packet.attachments === 0) {
                        super.emitReserved("decoded", packet);
                    }
                }
                else {
                    // non-binary full packet
                    super.emitReserved("decoded", packet);
                }
            }
            else if (isBinary(obj) || obj.base64) {
                // raw binary data
                if (!this.reconstructor) {
                    throw new Error("got binary data when not reconstructing a packet");
                }
                else {
                    packet = this.reconstructor.takeBinaryData(obj);
                    if (packet) {
                        // received final buffer
                        this.reconstructor = null;
                        super.emitReserved("decoded", packet);
                    }
                }
            }
            else {
                throw new Error("Unknown type: " + obj);
            }
        }
        /**
         * Decode a packet String (JSON data)
         *
         * @param {String} str
         * @return {Object} packet
         */
        decodeString(str) {
            let i = 0;
            // look up type
            const p = {
                type: Number(str.charAt(0)),
            };
            if (PacketType[p.type] === undefined) {
                throw new Error("unknown packet type " + p.type);
            }
            // look up attachments if type binary
            if (p.type === PacketType.BINARY_EVENT ||
                p.type === PacketType.BINARY_ACK) {
                const start = i + 1;
                while (str.charAt(++i) !== "-" && i != str.length) { }
                const buf = str.substring(start, i);
                if (buf != Number(buf) || str.charAt(i) !== "-") {
                    throw new Error("Illegal attachments");
                }
                p.attachments = Number(buf);
            }
            // look up namespace (if any)
            if ("/" === str.charAt(i + 1)) {
                const start = i + 1;
                while (++i) {
                    const c = str.charAt(i);
                    if ("," === c)
                        break;
                    if (i === str.length)
                        break;
                }
                p.nsp = str.substring(start, i);
            }
            else {
                p.nsp = "/";
            }
            // look up id
            const next = str.charAt(i + 1);
            if ("" !== next && Number(next) == next) {
                const start = i + 1;
                while (++i) {
                    const c = str.charAt(i);
                    if (null == c || Number(c) != c) {
                        --i;
                        break;
                    }
                    if (i === str.length)
                        break;
                }
                p.id = Number(str.substring(start, i + 1));
            }
            // look up json data
            if (str.charAt(++i)) {
                const payload = tryParse(str.substr(i));
                if (Decoder.isPayloadValid(p.type, payload)) {
                    p.data = payload;
                }
                else {
                    throw new Error("invalid payload");
                }
            }
            return p;
        }
        static isPayloadValid(type, payload) {
            switch (type) {
                case PacketType.CONNECT:
                    return typeof payload === "object";
                case PacketType.DISCONNECT:
                    return payload === undefined;
                case PacketType.CONNECT_ERROR:
                    return typeof payload === "string" || typeof payload === "object";
                case PacketType.EVENT:
                case PacketType.BINARY_EVENT:
                    return Array.isArray(payload) && payload.length > 0;
                case PacketType.ACK:
                case PacketType.BINARY_ACK:
                    return Array.isArray(payload);
            }
        }
        /**
         * Deallocates a parser's resources
         */
        destroy() {
            if (this.reconstructor) {
                this.reconstructor.finishedReconstruction();
            }
        }
    }
    function tryParse(str) {
        try {
            return JSON.parse(str);
        }
        catch (e) {
            return false;
        }
    }
    /**
     * A manager of a binary event's 'buffer sequence'. Should
     * be constructed whenever a packet of type BINARY_EVENT is
     * decoded.
     *
     * @param {Object} packet
     * @return {BinaryReconstructor} initialized reconstructor
     */
    class BinaryReconstructor {
        constructor(packet) {
            this.packet = packet;
            this.buffers = [];
            this.reconPack = packet;
        }
        /**
         * Method to be called when binary data received from connection
         * after a BINARY_EVENT packet.
         *
         * @param {Buffer | ArrayBuffer} binData - the raw binary data received
         * @return {null | Object} returns null if more binary data is expected or
         *   a reconstructed packet object if all buffers have been received.
         */
        takeBinaryData(binData) {
            this.buffers.push(binData);
            if (this.buffers.length === this.reconPack.attachments) {
                // done with buffer list
                const packet = reconstructPacket(this.reconPack, this.buffers);
                this.finishedReconstruction();
                return packet;
            }
            return null;
        }
        /**
         * Cleans up binary packet reconstruction variables.
         */
        finishedReconstruction() {
            this.reconPack = null;
            this.buffers = [];
        }
    }

    var parser = /*#__PURE__*/Object.freeze({
        __proto__: null,
        protocol: protocol,
        get PacketType () { return PacketType; },
        Encoder: Encoder,
        Decoder: Decoder
    });

    function on(obj, ev, fn) {
        obj.on(ev, fn);
        return function subDestroy() {
            obj.off(ev, fn);
        };
    }

    /**
     * Internal events.
     * These events can't be emitted by the user.
     */
    const RESERVED_EVENTS = Object.freeze({
        connect: 1,
        connect_error: 1,
        disconnect: 1,
        disconnecting: 1,
        // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
        newListener: 1,
        removeListener: 1,
    });
    class Socket extends Emitter_1 {
        /**
         * `Socket` constructor.
         *
         * @public
         */
        constructor(io, nsp, opts) {
            super();
            this.connected = false;
            this.disconnected = true;
            this.receiveBuffer = [];
            this.sendBuffer = [];
            this.ids = 0;
            this.acks = {};
            this.flags = {};
            this.io = io;
            this.nsp = nsp;
            if (opts && opts.auth) {
                this.auth = opts.auth;
            }
            if (this.io._autoConnect)
                this.open();
        }
        /**
         * Subscribe to open, close and packet events
         *
         * @private
         */
        subEvents() {
            if (this.subs)
                return;
            const io = this.io;
            this.subs = [
                on(io, "open", this.onopen.bind(this)),
                on(io, "packet", this.onpacket.bind(this)),
                on(io, "error", this.onerror.bind(this)),
                on(io, "close", this.onclose.bind(this)),
            ];
        }
        /**
         * Whether the Socket will try to reconnect when its Manager connects or reconnects
         */
        get active() {
            return !!this.subs;
        }
        /**
         * "Opens" the socket.
         *
         * @public
         */
        connect() {
            if (this.connected)
                return this;
            this.subEvents();
            if (!this.io["_reconnecting"])
                this.io.open(); // ensure open
            if ("open" === this.io._readyState)
                this.onopen();
            return this;
        }
        /**
         * Alias for connect()
         */
        open() {
            return this.connect();
        }
        /**
         * Sends a `message` event.
         *
         * @return self
         * @public
         */
        send(...args) {
            args.unshift("message");
            this.emit.apply(this, args);
            return this;
        }
        /**
         * Override `emit`.
         * If the event is in `events`, it's emitted normally.
         *
         * @return self
         * @public
         */
        emit(ev, ...args) {
            if (RESERVED_EVENTS.hasOwnProperty(ev)) {
                throw new Error('"' + ev + '" is a reserved event name');
            }
            args.unshift(ev);
            const packet = {
                type: PacketType.EVENT,
                data: args,
            };
            packet.options = {};
            packet.options.compress = this.flags.compress !== false;
            // event ack callback
            if ("function" === typeof args[args.length - 1]) {
                const id = this.ids++;
                const ack = args.pop();
                this._registerAckCallback(id, ack);
                packet.id = id;
            }
            const isTransportWritable = this.io.engine &&
                this.io.engine.transport &&
                this.io.engine.transport.writable;
            const discardPacket = this.flags.volatile && (!isTransportWritable || !this.connected);
            if (discardPacket) ;
            else if (this.connected) {
                this.packet(packet);
            }
            else {
                this.sendBuffer.push(packet);
            }
            this.flags = {};
            return this;
        }
        /**
         * @private
         */
        _registerAckCallback(id, ack) {
            const timeout = this.flags.timeout;
            if (timeout === undefined) {
                this.acks[id] = ack;
                return;
            }
            // @ts-ignore
            const timer = this.io.setTimeoutFn(() => {
                delete this.acks[id];
                for (let i = 0; i < this.sendBuffer.length; i++) {
                    if (this.sendBuffer[i].id === id) {
                        this.sendBuffer.splice(i, 1);
                    }
                }
                ack.call(this, new Error("operation has timed out"));
            }, timeout);
            this.acks[id] = (...args) => {
                // @ts-ignore
                this.io.clearTimeoutFn(timer);
                ack.apply(this, [null, ...args]);
            };
        }
        /**
         * Sends a packet.
         *
         * @param packet
         * @private
         */
        packet(packet) {
            packet.nsp = this.nsp;
            this.io._packet(packet);
        }
        /**
         * Called upon engine `open`.
         *
         * @private
         */
        onopen() {
            if (typeof this.auth == "function") {
                this.auth((data) => {
                    this.packet({ type: PacketType.CONNECT, data });
                });
            }
            else {
                this.packet({ type: PacketType.CONNECT, data: this.auth });
            }
        }
        /**
         * Called upon engine or manager `error`.
         *
         * @param err
         * @private
         */
        onerror(err) {
            if (!this.connected) {
                this.emitReserved("connect_error", err);
            }
        }
        /**
         * Called upon engine `close`.
         *
         * @param reason
         * @private
         */
        onclose(reason) {
            this.connected = false;
            this.disconnected = true;
            delete this.id;
            this.emitReserved("disconnect", reason);
        }
        /**
         * Called with socket packet.
         *
         * @param packet
         * @private
         */
        onpacket(packet) {
            const sameNamespace = packet.nsp === this.nsp;
            if (!sameNamespace)
                return;
            switch (packet.type) {
                case PacketType.CONNECT:
                    if (packet.data && packet.data.sid) {
                        const id = packet.data.sid;
                        this.onconnect(id);
                    }
                    else {
                        this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
                    }
                    break;
                case PacketType.EVENT:
                    this.onevent(packet);
                    break;
                case PacketType.BINARY_EVENT:
                    this.onevent(packet);
                    break;
                case PacketType.ACK:
                    this.onack(packet);
                    break;
                case PacketType.BINARY_ACK:
                    this.onack(packet);
                    break;
                case PacketType.DISCONNECT:
                    this.ondisconnect();
                    break;
                case PacketType.CONNECT_ERROR:
                    this.destroy();
                    const err = new Error(packet.data.message);
                    // @ts-ignore
                    err.data = packet.data.data;
                    this.emitReserved("connect_error", err);
                    break;
            }
        }
        /**
         * Called upon a server event.
         *
         * @param packet
         * @private
         */
        onevent(packet) {
            const args = packet.data || [];
            if (null != packet.id) {
                args.push(this.ack(packet.id));
            }
            if (this.connected) {
                this.emitEvent(args);
            }
            else {
                this.receiveBuffer.push(Object.freeze(args));
            }
        }
        emitEvent(args) {
            if (this._anyListeners && this._anyListeners.length) {
                const listeners = this._anyListeners.slice();
                for (const listener of listeners) {
                    listener.apply(this, args);
                }
            }
            super.emit.apply(this, args);
        }
        /**
         * Produces an ack callback to emit with an event.
         *
         * @private
         */
        ack(id) {
            const self = this;
            let sent = false;
            return function (...args) {
                // prevent double callbacks
                if (sent)
                    return;
                sent = true;
                self.packet({
                    type: PacketType.ACK,
                    id: id,
                    data: args,
                });
            };
        }
        /**
         * Called upon a server acknowlegement.
         *
         * @param packet
         * @private
         */
        onack(packet) {
            const ack = this.acks[packet.id];
            if ("function" === typeof ack) {
                ack.apply(this, packet.data);
                delete this.acks[packet.id];
            }
        }
        /**
         * Called upon server connect.
         *
         * @private
         */
        onconnect(id) {
            this.id = id;
            this.connected = true;
            this.disconnected = false;
            this.emitBuffered();
            this.emitReserved("connect");
        }
        /**
         * Emit buffered events (received and emitted).
         *
         * @private
         */
        emitBuffered() {
            this.receiveBuffer.forEach((args) => this.emitEvent(args));
            this.receiveBuffer = [];
            this.sendBuffer.forEach((packet) => this.packet(packet));
            this.sendBuffer = [];
        }
        /**
         * Called upon server disconnect.
         *
         * @private
         */
        ondisconnect() {
            this.destroy();
            this.onclose("io server disconnect");
        }
        /**
         * Called upon forced client/server side disconnections,
         * this method ensures the manager stops tracking us and
         * that reconnections don't get triggered for this.
         *
         * @private
         */
        destroy() {
            if (this.subs) {
                // clean subscriptions to avoid reconnections
                this.subs.forEach((subDestroy) => subDestroy());
                this.subs = undefined;
            }
            this.io["_destroy"](this);
        }
        /**
         * Disconnects the socket manually.
         *
         * @return self
         * @public
         */
        disconnect() {
            if (this.connected) {
                this.packet({ type: PacketType.DISCONNECT });
            }
            // remove socket from pool
            this.destroy();
            if (this.connected) {
                // fire events
                this.onclose("io client disconnect");
            }
            return this;
        }
        /**
         * Alias for disconnect()
         *
         * @return self
         * @public
         */
        close() {
            return this.disconnect();
        }
        /**
         * Sets the compress flag.
         *
         * @param compress - if `true`, compresses the sending data
         * @return self
         * @public
         */
        compress(compress) {
            this.flags.compress = compress;
            return this;
        }
        /**
         * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
         * ready to send messages.
         *
         * @returns self
         * @public
         */
        get volatile() {
            this.flags.volatile = true;
            return this;
        }
        /**
         * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
         * given number of milliseconds have elapsed without an acknowledgement from the server:
         *
         * ```
         * socket.timeout(5000).emit("my-event", (err) => {
         *   if (err) {
         *     // the server did not acknowledge the event in the given delay
         *   }
         * });
         * ```
         *
         * @returns self
         * @public
         */
        timeout(timeout) {
            this.flags.timeout = timeout;
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback.
         *
         * @param listener
         * @public
         */
        onAny(listener) {
            this._anyListeners = this._anyListeners || [];
            this._anyListeners.push(listener);
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback. The listener is added to the beginning of the listeners array.
         *
         * @param listener
         * @public
         */
        prependAny(listener) {
            this._anyListeners = this._anyListeners || [];
            this._anyListeners.unshift(listener);
            return this;
        }
        /**
         * Removes the listener that will be fired when any event is emitted.
         *
         * @param listener
         * @public
         */
        offAny(listener) {
            if (!this._anyListeners) {
                return this;
            }
            if (listener) {
                const listeners = this._anyListeners;
                for (let i = 0; i < listeners.length; i++) {
                    if (listener === listeners[i]) {
                        listeners.splice(i, 1);
                        return this;
                    }
                }
            }
            else {
                this._anyListeners = [];
            }
            return this;
        }
        /**
         * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
         * e.g. to remove listeners.
         *
         * @public
         */
        listenersAny() {
            return this._anyListeners || [];
        }
    }

    /**
     * Expose `Backoff`.
     */

    var backo2 = Backoff;

    /**
     * Initialize backoff timer with `opts`.
     *
     * - `min` initial timeout in milliseconds [100]
     * - `max` max timeout [10000]
     * - `jitter` [0]
     * - `factor` [2]
     *
     * @param {Object} opts
     * @api public
     */

    function Backoff(opts) {
      opts = opts || {};
      this.ms = opts.min || 100;
      this.max = opts.max || 10000;
      this.factor = opts.factor || 2;
      this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
      this.attempts = 0;
    }

    /**
     * Return the backoff duration.
     *
     * @return {Number}
     * @api public
     */

    Backoff.prototype.duration = function(){
      var ms = this.ms * Math.pow(this.factor, this.attempts++);
      if (this.jitter) {
        var rand =  Math.random();
        var deviation = Math.floor(rand * this.jitter * ms);
        ms = (Math.floor(rand * 10) & 1) == 0  ? ms - deviation : ms + deviation;
      }
      return Math.min(ms, this.max) | 0;
    };

    /**
     * Reset the number of attempts.
     *
     * @api public
     */

    Backoff.prototype.reset = function(){
      this.attempts = 0;
    };

    /**
     * Set the minimum duration
     *
     * @api public
     */

    Backoff.prototype.setMin = function(min){
      this.ms = min;
    };

    /**
     * Set the maximum duration
     *
     * @api public
     */

    Backoff.prototype.setMax = function(max){
      this.max = max;
    };

    /**
     * Set the jitter
     *
     * @api public
     */

    Backoff.prototype.setJitter = function(jitter){
      this.jitter = jitter;
    };

    class Manager extends Emitter_1 {
        constructor(uri, opts) {
            var _a;
            super();
            this.nsps = {};
            this.subs = [];
            if (uri && "object" === typeof uri) {
                opts = uri;
                uri = undefined;
            }
            opts = opts || {};
            opts.path = opts.path || "/socket.io";
            this.opts = opts;
            installTimerFunctions(this, opts);
            this.reconnection(opts.reconnection !== false);
            this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
            this.reconnectionDelay(opts.reconnectionDelay || 1000);
            this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
            this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
            this.backoff = new backo2({
                min: this.reconnectionDelay(),
                max: this.reconnectionDelayMax(),
                jitter: this.randomizationFactor(),
            });
            this.timeout(null == opts.timeout ? 20000 : opts.timeout);
            this._readyState = "closed";
            this.uri = uri;
            const _parser = opts.parser || parser;
            this.encoder = new _parser.Encoder();
            this.decoder = new _parser.Decoder();
            this._autoConnect = opts.autoConnect !== false;
            if (this._autoConnect)
                this.open();
        }
        reconnection(v) {
            if (!arguments.length)
                return this._reconnection;
            this._reconnection = !!v;
            return this;
        }
        reconnectionAttempts(v) {
            if (v === undefined)
                return this._reconnectionAttempts;
            this._reconnectionAttempts = v;
            return this;
        }
        reconnectionDelay(v) {
            var _a;
            if (v === undefined)
                return this._reconnectionDelay;
            this._reconnectionDelay = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
            return this;
        }
        randomizationFactor(v) {
            var _a;
            if (v === undefined)
                return this._randomizationFactor;
            this._randomizationFactor = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
            return this;
        }
        reconnectionDelayMax(v) {
            var _a;
            if (v === undefined)
                return this._reconnectionDelayMax;
            this._reconnectionDelayMax = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
            return this;
        }
        timeout(v) {
            if (!arguments.length)
                return this._timeout;
            this._timeout = v;
            return this;
        }
        /**
         * Starts trying to reconnect if reconnection is enabled and we have not
         * started reconnecting yet
         *
         * @private
         */
        maybeReconnectOnOpen() {
            // Only try to reconnect if it's the first time we're connecting
            if (!this._reconnecting &&
                this._reconnection &&
                this.backoff.attempts === 0) {
                // keeps reconnection from firing twice for the same reconnection loop
                this.reconnect();
            }
        }
        /**
         * Sets the current transport `socket`.
         *
         * @param {Function} fn - optional, callback
         * @return self
         * @public
         */
        open(fn) {
            if (~this._readyState.indexOf("open"))
                return this;
            this.engine = new Socket$1(this.uri, this.opts);
            const socket = this.engine;
            const self = this;
            this._readyState = "opening";
            this.skipReconnect = false;
            // emit `open`
            const openSubDestroy = on(socket, "open", function () {
                self.onopen();
                fn && fn();
            });
            // emit `error`
            const errorSub = on(socket, "error", (err) => {
                self.cleanup();
                self._readyState = "closed";
                this.emitReserved("error", err);
                if (fn) {
                    fn(err);
                }
                else {
                    // Only do this if there is no fn to handle the error
                    self.maybeReconnectOnOpen();
                }
            });
            if (false !== this._timeout) {
                const timeout = this._timeout;
                if (timeout === 0) {
                    openSubDestroy(); // prevents a race condition with the 'open' event
                }
                // set timer
                const timer = this.setTimeoutFn(() => {
                    openSubDestroy();
                    socket.close();
                    // @ts-ignore
                    socket.emit("error", new Error("timeout"));
                }, timeout);
                if (this.opts.autoUnref) {
                    timer.unref();
                }
                this.subs.push(function subDestroy() {
                    clearTimeout(timer);
                });
            }
            this.subs.push(openSubDestroy);
            this.subs.push(errorSub);
            return this;
        }
        /**
         * Alias for open()
         *
         * @return self
         * @public
         */
        connect(fn) {
            return this.open(fn);
        }
        /**
         * Called upon transport open.
         *
         * @private
         */
        onopen() {
            // clear old subs
            this.cleanup();
            // mark as open
            this._readyState = "open";
            this.emitReserved("open");
            // add new subs
            const socket = this.engine;
            this.subs.push(on(socket, "ping", this.onping.bind(this)), on(socket, "data", this.ondata.bind(this)), on(socket, "error", this.onerror.bind(this)), on(socket, "close", this.onclose.bind(this)), on(this.decoder, "decoded", this.ondecoded.bind(this)));
        }
        /**
         * Called upon a ping.
         *
         * @private
         */
        onping() {
            this.emitReserved("ping");
        }
        /**
         * Called with data.
         *
         * @private
         */
        ondata(data) {
            this.decoder.add(data);
        }
        /**
         * Called when parser fully decodes a packet.
         *
         * @private
         */
        ondecoded(packet) {
            this.emitReserved("packet", packet);
        }
        /**
         * Called upon socket error.
         *
         * @private
         */
        onerror(err) {
            this.emitReserved("error", err);
        }
        /**
         * Creates a new socket for the given `nsp`.
         *
         * @return {Socket}
         * @public
         */
        socket(nsp, opts) {
            let socket = this.nsps[nsp];
            if (!socket) {
                socket = new Socket(this, nsp, opts);
                this.nsps[nsp] = socket;
            }
            return socket;
        }
        /**
         * Called upon a socket close.
         *
         * @param socket
         * @private
         */
        _destroy(socket) {
            const nsps = Object.keys(this.nsps);
            for (const nsp of nsps) {
                const socket = this.nsps[nsp];
                if (socket.active) {
                    return;
                }
            }
            this._close();
        }
        /**
         * Writes a packet.
         *
         * @param packet
         * @private
         */
        _packet(packet) {
            const encodedPackets = this.encoder.encode(packet);
            for (let i = 0; i < encodedPackets.length; i++) {
                this.engine.write(encodedPackets[i], packet.options);
            }
        }
        /**
         * Clean up transport subscriptions and packet buffer.
         *
         * @private
         */
        cleanup() {
            this.subs.forEach((subDestroy) => subDestroy());
            this.subs.length = 0;
            this.decoder.destroy();
        }
        /**
         * Close the current socket.
         *
         * @private
         */
        _close() {
            this.skipReconnect = true;
            this._reconnecting = false;
            this.onclose("forced close");
            if (this.engine)
                this.engine.close();
        }
        /**
         * Alias for close()
         *
         * @private
         */
        disconnect() {
            return this._close();
        }
        /**
         * Called upon engine close.
         *
         * @private
         */
        onclose(reason) {
            this.cleanup();
            this.backoff.reset();
            this._readyState = "closed";
            this.emitReserved("close", reason);
            if (this._reconnection && !this.skipReconnect) {
                this.reconnect();
            }
        }
        /**
         * Attempt a reconnection.
         *
         * @private
         */
        reconnect() {
            if (this._reconnecting || this.skipReconnect)
                return this;
            const self = this;
            if (this.backoff.attempts >= this._reconnectionAttempts) {
                this.backoff.reset();
                this.emitReserved("reconnect_failed");
                this._reconnecting = false;
            }
            else {
                const delay = this.backoff.duration();
                this._reconnecting = true;
                const timer = this.setTimeoutFn(() => {
                    if (self.skipReconnect)
                        return;
                    this.emitReserved("reconnect_attempt", self.backoff.attempts);
                    // check again for the case socket closed in above events
                    if (self.skipReconnect)
                        return;
                    self.open((err) => {
                        if (err) {
                            self._reconnecting = false;
                            self.reconnect();
                            this.emitReserved("reconnect_error", err);
                        }
                        else {
                            self.onreconnect();
                        }
                    });
                }, delay);
                if (this.opts.autoUnref) {
                    timer.unref();
                }
                this.subs.push(function subDestroy() {
                    clearTimeout(timer);
                });
            }
        }
        /**
         * Called upon successful reconnect.
         *
         * @private
         */
        onreconnect() {
            const attempt = this.backoff.attempts;
            this._reconnecting = false;
            this.backoff.reset();
            this.emitReserved("reconnect", attempt);
        }
    }

    /**
     * Managers cache.
     */
    const cache = {};
    function lookup(uri, opts) {
        if (typeof uri === "object") {
            opts = uri;
            uri = undefined;
        }
        opts = opts || {};
        const parsed = url(uri, opts.path || "/socket.io");
        const source = parsed.source;
        const id = parsed.id;
        const path = parsed.path;
        const sameNamespace = cache[id] && path in cache[id]["nsps"];
        const newConnection = opts.forceNew ||
            opts["force new connection"] ||
            false === opts.multiplex ||
            sameNamespace;
        let io;
        if (newConnection) {
            io = new Manager(source, opts);
        }
        else {
            if (!cache[id]) {
                cache[id] = new Manager(source, opts);
            }
            io = cache[id];
        }
        if (parsed.query && !opts.query) {
            opts.query = parsed.queryKey;
        }
        return io.socket(parsed.path, opts);
    }
    // so that "lookup" can be used both as a function (e.g. `io(...)`) and as a
    // namespace (e.g. `io.connect(...)`), for backward compatibility
    Object.assign(lookup, {
        Manager,
        Socket,
        io: lookup,
        connect: lookup,
    });

    /* src/App.svelte generated by Svelte v3.38.2 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (48:12) {#each messages as msg}
    function create_each_block(ctx) {
    	let div2;
    	let div0;
    	let strong;
    	let t0_value = /*msg*/ ctx[9].message.username + "";
    	let t0;
    	let t1;
    	let div1;
    	let t2_value = /*msg*/ ctx[9].message.message + "";
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			strong = element("strong");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			attr_dev(strong, "class", "mb-1");
    			add_location(strong, file, 50, 24, 1597);
    			attr_dev(div0, "class", "d-flex w-100 align-items-center justify-content-between");
    			add_location(div0, file, 49, 20, 1503);
    			attr_dev(div1, "class", "col-10 mb-1 small");
    			add_location(div1, file, 52, 20, 1697);
    			attr_dev(div2, "class", "list-group-item list-group-item-action py-3 lh-tight");
    			add_location(div2, file, 48, 16, 1416);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, strong);
    			append_dev(strong, t0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, t2);
    			append_dev(div2, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*messages*/ 4 && t0_value !== (t0_value = /*msg*/ ctx[9].message.username + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*messages*/ 4 && t2_value !== (t2_value = /*msg*/ ctx[9].message.message + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(48:12) {#each messages as msg}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div3;
    	let div2;
    	let div0;
    	let input0;
    	let t0;
    	let div1;
    	let t1;
    	let form;
    	let input1;
    	let button;
    	let mounted;
    	let dispose;
    	let each_value = /*messages*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			input0 = element("input");
    			t0 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			form = element("form");
    			input1 = element("input");
    			button = element("button");
    			button.textContent = "Send";
    			attr_dev(input0, "class", "fs-5 fw-semibold");
    			attr_dev(input0, "placeholder", "Enter your name");
    			add_location(input0, file, 44, 12, 1188);
    			attr_dev(div0, "class", "d-flex align-items-center flex-shrink-0 p-3 link-dark text-decoration-none border-bottom");
    			add_location(div0, file, 43, 8, 1073);
    			attr_dev(div1, "class", "list-group list-group-flush border-bottom scrollarea svelte-a4p9zu");
    			add_location(div1, file, 46, 8, 1297);
    			attr_dev(div2, "class", "d-flex flex-column align-items-stretch flex-shrink-0 bg-white");
    			add_location(div2, file, 42, 4, 989);
    			attr_dev(input1, "id", "input");
    			attr_dev(input1, "class", "form-control svelte-a4p9zu");
    			attr_dev(input1, "placeholder", "Write a message");
    			add_location(input1, file, 58, 8, 1888);
    			attr_dev(button, "class", "svelte-a4p9zu");
    			add_location(button, file, 58, 99, 1979);
    			attr_dev(form, "id", "form");
    			attr_dev(form, "class", "svelte-a4p9zu");
    			add_location(form, file, 57, 4, 1829);
    			attr_dev(div3, "class", "container");
    			add_location(div3, file, 41, 0, 961);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div0, input0);
    			set_input_value(input0, /*username*/ ctx[0]);
    			append_dev(div2, t0);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			append_dev(div3, t1);
    			append_dev(div3, form);
    			append_dev(form, input1);
    			set_input_value(input1, /*message*/ ctx[1]);
    			append_dev(form, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[4]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[5]),
    					listen_dev(form, "submit", prevent_default(/*submit*/ ctx[3]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*username*/ 1 && input0.value !== /*username*/ ctx[0]) {
    				set_input_value(input0, /*username*/ ctx[0]);
    			}

    			if (dirty & /*messages*/ 4) {
    				each_value = /*messages*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*message*/ 2 && input1.value !== /*message*/ ctx[1]) {
    				set_input_value(input1, /*message*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let STRAPI_ENDPOINT = "http://localhost:1337";

    	//let STRAPI_ENDPOINT = 'https://code-school.biz:1443'
    	var socket = lookup(STRAPI_ENDPOINT);

    	let username = "";
    	let message = "";
    	let messages = [];

    	onMount(() => {
    		Pusher.logToConsole = true;
    		const pusher = new Pusher("", { cluster: "" });
    		const channel = pusher.subscribe("chat");

    		channel.bind("message", data => {
    			$$invalidate(2, messages = [...messages, data]);
    		});
    	});

    	socket.on("chat message", function (msg) {
    		console.log("chat message = ", msg);
    		$$invalidate(2, messages = [...messages, msg]);
    		console.log("messages = ", messages);
    		console.log(typeof msg);
    	});

    	const submit = async () => {
    		console.log("button pressed!");
    		socket.emit("join", { message, username });
    		$$invalidate(1, message = "");
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		username = this.value;
    		$$invalidate(0, username);
    	}

    	function input1_input_handler() {
    		message = this.value;
    		$$invalidate(1, message);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		Pusher,
    		io: lookup,
    		STRAPI_ENDPOINT,
    		socket,
    		username,
    		message,
    		messages,
    		submit
    	});

    	$$self.$inject_state = $$props => {
    		if ("STRAPI_ENDPOINT" in $$props) STRAPI_ENDPOINT = $$props.STRAPI_ENDPOINT;
    		if ("socket" in $$props) socket = $$props.socket;
    		if ("username" in $$props) $$invalidate(0, username = $$props.username);
    		if ("message" in $$props) $$invalidate(1, message = $$props.message);
    		if ("messages" in $$props) $$invalidate(2, messages = $$props.messages);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		username,
    		message,
    		messages,
    		submit,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
