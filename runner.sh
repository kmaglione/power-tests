#!/bin/sh

FIREFOX=${FIREFOX:-"C:/Program Files (x86)/Mozilla Firefox/firefox.exe"}
POWERLOG=${POWERLOG:-"C:/Program Files/Intel/Power Gadget 2.6/PowerLog.exe"}

SKELETON_PROFILE=${SKELETON_PROFILE:-"$(pwd)/profile"}

profile="$(pwd)/test-profile-${TEST_ADDON_BASENAME}"

if [ $# = 0 ]
then
    echo No add-ons to install. Running last instance.
else
    echo Wiping profile

    rm -rf "$profile"
    cp -r "$SKELETON_PROFILE" "$profile"

    stage="$profile/extensions/staged-xpis"
    mkdir -p "$stage"

    for arg in $@
    do
        echo Installing $arg
	d="$stage/${arg##*/}/"
	mkdir -p $d
        cp $arg "$d"
    done
fi

[ -n "$POWERLOG_OUTPUT" ] && export POWERLOG_JSON="${POWERLOG_OUTPUT%.csv}.json"

"$POWERLOG" -cmd "$FIREFOX" -console -no-remote -profile "$profile"

[ -n "$POWERLOG_OUTPUT" ] && cp PowerLog.ipg $POWERLOG_OUTPUT
