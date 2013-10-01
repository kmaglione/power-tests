
const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

const TEST_URL = "http://enwp.org/Gustav_Mahler";

var FIRST_RUN_QUIT_TIMEOUT = 1000;
var START_TIMEOUT = 5 * 1000;
var QUIT_TIMEOUT = 10 * 1000;
var TEST_TIMEOUT = 10 * 1000;

const TEST_URLS = [
    "http://ruby-doc.org/stdlib-2.0.0/",
    "https://www.google.com/search?num=50&hl=en&site=&tbm=isch&source=hp&biw=1918&bih=978&q=mozilla&oq=&gs_l=",
    "https://en.wikipedia.org/wiki/Mahler",
    "http://www.youtube.com/",
    "http://www.smbc-comics.com/",
    "http://slashdot.org/",
];

Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://gre/modules/Services.jsm");
const { TextEncoder } = Cu.import("resource://gre/modules/osfile.jsm");

let appStartup = Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIAppStartup);
let environment = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
let memory = Cc["@mozilla.org/memory-reporter-manager;1"].getService(Ci.nsIMemoryReporterManager);

const MEM_NOTIFY_PREF = "javascript.options.mem.notify";

function wrap(fn) {
    return fn.wrapper = function wrapper() {
        try {
            return fn.apply(this, arguments);
        }
        catch (e) {
            Cu.reportError(e);
            throw e;
        }
    }
}

var observer = {
    firstWindow: false,

    init: function init() {
        this.firstRun = prefs.get("firstRun", true);
        prefs.set("firstRun", false);

        allPrefs.set(MEM_NOTIFY_PREF, true);

        this.startTime = appStartup.getStartupInfo().process.getTime();

        this.times = [];
        this.startTimes = {};
        this.mark('Init');

        Services.obs.addObserver(this, "xul-window-visible", false);
        Services.obs.addObserver(this, "cycle-collection-statistics", false);
        Services.obs.addObserver(this, "garbage-collection-statistics", false);

        for (let [library, args] of [["msvcrt.dll", ["_getpid", ctypes.default_abi, ctypes.int]],
                                     ["libc.so.6",  ["getpid", ctypes.default_abi, ctypes.int]]]) {
            try {
                let libc = ctypes.open(library);
                try {
                    this.pid = libc.declare.apply(libc, args)();
                    break;
                }
                finally {
                    libc.close();
                }
            }
            catch (e) {}
         }
    },

    removeObserver: function removeObserver() {
        if (!this.observerRemoved)
            Services.obs.removeObserver(this, "xul-window-visible");
        this.observerRemoved = true;
    },

    shutdown: function shutdown() {
        allPrefs.reset(MEM_NOTIFY_PREF);

        this.removeObserver();
        Services.obs.removeObserver(this, "cycle-collection-statistics");
        Services.obs.removeObserver(this, "garbage-collection-statistics");
    },

    get logData() ({
        startTime: this.startTime,
        pid: this.pid,
        memory: {
            initial: this.initialMemoryUse,
            preCleanup: this.preCleanupMemoryUse,
            final: this.memoryUse
        },
        times: this.times,
    }),

    get memoryUse() ({
        explicit: memory.explicit,
        resident: memory.resident
    }),

    // Mark the time of an event for the JSON output.
    mark: function mark(event, time) {
        if (Array.isArray(time))
            time = time.map(t => t - this.startTime);
        else
            time = (time || Date.now()) - this.startTime;

        this.times.push([time, event]);
    },

    start: function start(event, time) {
        this.startTimes[event] = time || Date.now();
    },

    end: function end(event, time) {
        this.mark(event, [this.startTimes[event], time || Date.now()]);
    },

    observe: wrap(function observe(subject, topic, data) {
        if (topic == "xul-window-visible") {
            let w = Services.wm.getMostRecentWindow("navigator:browser");
            if (w && w.document.readyState == "complete") {
                this.removeObserver();
                this.onWindowReady(w);
            }
        }
        else if (topic == "cycle-collection-statistics") {
            data = JSON.parse(data);

            let timestamp = data.timestamp / 1000;
            this.mark('Cycle Collection', [timestamp - data.duration,
                                           timestamp]);
        }
        else if (topic == "garbage-collection-statistics") {
            data = JSON.parse(data);

            let slice = data.slices[data.slices.length - 1];
            let timestamp = data.timestamp / 1000 - slice.when - slice.pause;

            for (let slice of data.slices) {
                this.mark('GC Slice', [timestamp + slice.when,
                                       timestamp + slice.when + slice.pause]);
            }
        }
    }),

    onWindowReady: function onWindowReady(window) {
        this.mark('Window visible');
        this.initialMemoryUse = this.memoryUse;

        if (this.firstRun) {
            START_TIMEOUT = FIRST_RUN_QUIT_TIMEOUT;
            QUIT_TIMEOUT = FIRST_RUN_QUIT_TIMEOUT;
            TEST_TIMEOUT = 0;
        }
        window.setTimeout(wrap(this.doStuff.bind(this, window)), START_TIMEOUT);
    },

    doStuff: function doStuff(window) {
        window.setInterval(function () {
            let doc = window.gBrowser.mCurrentBrowser.contentDocument;

            // If we get a network error, we'll never get a load event
            // and our tests will stall. Eventually we'll want to throw
            // away these runs, but for now just keep slogging through
            // and count on the numbers being thrown away as outliers.
            if (doc.documentURI.indexOf("about:neterror?") == 0)
                doc.location.reload();
        }, 10000);

        this.urls = TEST_URLS.slice();
        this.loadTab(window, this.urls.shift());
    },

    loadTab: function loadTab(window, url) {
        let { gBrowser } = window;

        this.start('Load URL');

        let self = this;
        let tab = gBrowser.addTab(url);

        tab.linkedBrowser.addEventListener("load", wrap(function onLoad(event) {
            this.removeEventListener("load", onLoad.wrapper, true);

            self.onTabLoad(this, window);
        }), true);

        gBrowser.selectedTab = tab;
    },

    onTabLoad: function onTabLoad(tab, window) {
        this.end('Load URL');

        if (this.urls.length)
            window.setTimeout(() => {
                this.loadTab(window, this.urls.shift());
            }, TEST_TIMEOUT);
        else
            this.finish(window);
    },

    finish: function finish(window) {
        window.setTimeout(() => {
            let logFile = environment.get("POWERLOG_JSON");
            if (!logFile)
                this.quit();
            else {
                this.preCleanupMemoryUse = this.memoryUse;

                this.mark('Remove tabs');

                let { gBrowser } = window;
                Array.slice(gBrowser.tabs, 1).forEach(t => gBrowser.removeTab(t));

                this.mark('Minimize memory');
                memory.minimizeMemoryUsage(() => {
                    this.mark('Quit');
                    OS.File.writeAtomic(logFile, TextEncoder().encode(JSON.stringify(this.logData)),
                                        { tmpPath: logFile + ".part" })
                      .then(this.quit.bind(this), (f) => { dump("Fail! " + f + "\n"); Cu.reportError(f) });
                });
            }
        }, QUIT_TIMEOUT);
    },

    quit: function quit(force) {
        Services.startup.quit(Services.startup[force ? "eAttemptQuit" : "eForceQuit"]);
    }
};

function startup(data, reason) {
    observer.init();
}

function shutdown(data, reason) {
    observer.shutdown();
}

function install() {}
function uninstall() {}

const SupportsString = Components.Constructor("@mozilla.org/supports-string;1", "nsISupportsString");
function Prefs(branch, defaults) {
    this.constructor = Prefs; // Ends up Object otherwise... Why?

    this.branch = Services.prefs[defaults ? "getDefaultBranch" : "getBranch"](branch || "");
    if (this.branch instanceof Ci.nsIPrefBranch2)
        this.branch.QueryInterface(Ci.nsIPrefBranch2);

    this.defaults = defaults ? this : new this.constructor(branch, true);
}
Prefs.prototype = {
    /**
     * Returns a new Prefs object for the sub-branch *branch* of this
     * object.
     *
     * @param {string} branch The sub-branch to return.
     */
    Branch: function Branch(branch) new this.constructor(this.root + branch),

    /**
     * Clears the entire branch.
     *
     * @param {string} name The name of the preference branch to delete.
     */
    clear: function clear(branch) {
        this.branch.deleteBranch(branch || "");
    },

    /**
     * Returns the full name of this object's preference branch.
     */
    get root() this.branch.root,

    /**
     * Returns the value of the preference *name*, or *defaultValue* if
     * the preference does not exist.
     *
     * @param {string} name The name of the preference to return.
     * @param {*} defaultValue The value to return if the preference has no value.
     * @optional
     */
    get: function get(name, defaultValue) {
        let type = this.branch.getPrefType(name);

        if (type === Ci.nsIPrefBranch.PREF_STRING)
            return this.branch.getComplexValue(name, Ci.nsISupportsString).data;

        if (type === Ci.nsIPrefBranch.PREF_INT)
            return this.branch.getIntPref(name);

        if (type === Ci.nsIPrefBranch.PREF_BOOL)
            return this.branch.getBoolPref(name);

        return defaultValue;
    },

    /**
     * Returns true if the given preference exists in this branch.
     *
     * @param {string} name The name of the preference to check.
     */
    has: function has(name) this.branch.getPrefType(name) !== 0,

    /**
     * Returns an array of all preference names in this branch or the
     * given sub-branch.
     *
     * @param {string} branch The sub-branch for which to return preferences.
     * @optional
     */
    getNames: function getNames(branch) this.branch.getChildList(branch || "", { value: 0 }),

    /**
     * Returns true if the given preference is set to its default value.
     *
     * @param {string} name The name of the preference to check.
     */
    isDefault: function isDefault(name) !this.branch.prefHasUserValue(name),

    /**
     * Sets the preference *name* to *value*. If the preference already
     * exists, it must have the same type as the given value.
     *
     * @param {name} name The name of the preference to change.
     * @param {string|number|boolean} value The value to set.
     */
    set: function set(name, value) {
        let type = typeof value;
        if (type === "string") {
            let string = SupportsString();
            string.data = value;
            this.branch.setComplexValue(name, Ci.nsISupportsString, string);
        }
        else if (type === "number")
            this.branch.setIntPref(name, value);
        else if (type === "boolean")
            this.branch.setBoolPref(name, value);
        else
            throw TypeError("Unknown preference type: " + type);
    },

    /**
     * Resets the preference *name* to its default value.
     *
     * @param {string} name The name of the preference to reset.
     */
    reset: function reset(name) {
        if (this.branch.prefHasUserValue(name))
            this.branch.clearUserPref(name);
    }
};

let prefs = new Prefs("extensions.addon-power-tests.");
let allPrefs = new Prefs("");
