#!/bin/sh

harness_addon=power-test@dactyl.googlecode.com.xpi

each_addon() {
    addon=
    basename=baseline
    $@

    for addon in addons/*.xpi
    do
        basename=${addon%.xpi}
        basename=${basename#*/}
	export TEST_ADDON_BASENAME=$basename
        $@
    done
}

init_addon() {
    echo INIT ADDON $addon $basename
    ./runner.sh "$harness_addon" $addon
}

test_addon() {
    echo TEST ADDON RUN $run $addon $basename
    export POWERLOG_OUTPUT="data/$basename-run$run.csv"
    ./runner.sh
}

each_addon init_addon
for run in 1 2 3 4 5
do
    each_addon test_addon
done
