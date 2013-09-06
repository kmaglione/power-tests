Add-on Power Tests
==================

This project is a stupid simple test harness to test the affects of
add-ons on Firefox's power consumption using Intel's Power Gadget.
It consists of two components: a script to setup and launch Firefox,
and an add-on to control it.

``runner.sh``
-------------

This script provisions Firefox with any number of add-ons, launches
it via Intel's Power Gadget power recorder, and then stores the
results. When run with arguments, the skeleton profile ``profile/`` is
copied to a new directory, and all arguments are assumed to be
extension XPIs, and are installed to it. On subsequent runs with no
arguments, the previously instantiated profile is reused.

The following variables affect the script's operation:

``$FIREFOX``
    The path to the Firefox executable.
    Default: ``C:/Program Files (x86)/Mozilla Firefox/firefox.exe``

``$POWERLOG``
    The path to the Intel Power Gadget PowerLog executable.
    Default: ``C:/Program Files/Intel/Power Gadget 2.6/PowerLog.exe``

``$SKELETON_PROFILE``
    The path to the skeleton profile from which to initialize the
    test profile.
    Default: ``./profile``

``$POWERLOG_OUTPUT``
    The path to the power log output file. If omitted, the log will
    not be saved. If present, ``$POWERLOG_JSON`` will be set to an
    appropriate value for the harness add-on.

The script is adapted to run on Windows in a MinGW or Cygwin
environment, but can be adapted to run on any platform supported by
Intel's Power Gadget.

The harness add-on
------------------

The ``addon/`` directory contains a simple test harness add-on which
is intended to be installed via the ``runner.sh`` script. On the first
run after installation, it waits for the first browser window to
open and then quits after a short delay. This allows add-ons to
complete first-run initialization without impacting power tests on
subsequent runs.

On second and subsequent runs, the add-on waits for the first
browser window to open, opens a series of URLs in tabs, and then
cleans up and quits after a 30 second delay. If the ``$POWERLOG_JSON``
environment variable is set, it also dumps timing information for
the various actions it completes, and several memory usage samples
to the file named therein.


The testing process
-------------------

An appropriate skeleton profile need to be created and saved to the
patch indicated by ``$SKELETON_PROFILE``. At the very least, the
profile needs to include the following setting changes:

- Update mechanisms need to be disabled, including app, extension,
  add-on metadata, safe browsing database, blocklist, and sync
  updates.

- Firefox Health Report and Telemetry reporting should be disabled.

- The ``startup.homepage_override_url`` preference should be cleared.

When running on Windows, all unnecessary services should be
disabled, and at least the following changes should be made:

- Disable the disk defragmenter, search indexer, screen saver,
  Windows updates, Windows Firewall, Windows Defender, any
  anti-virus services.

- Disable the Firefox update service.

- Change power settings to disable display dimming, adaptive
  brightness, suspend/hibernate. Select the 'Balanced' power plan.

The test process for a given add-on should be as follows:

1) Invoke ``runner.sh`` with the path to the XPI of the add-on to be
   tested and the path to the harness add-on.

2) Set the ``$POWERLOG_OUTPUT`` variable to the file where the
   PowerLog CSV should be saved. Invoke ``runner.sh`` again without
   arguments.

3) Repeat the above several times, with non-clashing values for
   ``$POWERLOG_OUTPUT`` each run, and use the run with the median
   cumulative power usage for the basis of analysis.
