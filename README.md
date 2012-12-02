phi-accrual-detector
====================

What Is It?
===

This is a port of [Akka's Accrual Failure Detector](https://github.com/akka/akka/blob/master/akka-cluster/src/main/scala/akka/cluster/AccrualFailureDetector.scala)
to Node.JS.  It is an implementation of 'The Phi Accrual Failure Detector'
by Hayashibara et al. as defined in their [paper](http://ddg.jaist.ac.jp/pub/HDY+04.pdf)

Why Use It?
===

The Phi-accrual detector provides a configurable, continuous
'suspicion of failure' measurement for remote systems whose
availability is indirectly measured by heartbeats or samples.
Examples:

* Network servers
   * Is that HTTP server up?
* Out-of-process 'worker' event sources
   * Did that job handler crash?

The suspicion level adjusts to the recorded inter-event periods, which makes it
more resilient to event sources that [sawtooth](/test/charts/degrading-source.html)
into stability.

Usage
===

1. Install it: `npm install phi-accrual-detector`
2. Determine the configuration settings.  These are largely
copied from the [Akka source](https://github.com/akka/akka/blob/master/akka-cluster/src/main/scala/akka/cluster/AccrualFailureDetector.scala#L38).
    1. *threshold*: The suspicion level above which the event source
                    is considered to have failed.
    2. *max_sample_size* : The maximum number of samples to store
                            for mean and standard deviation calculations
                            of event reports.
    3. *min_std_deviation* : Minimum standard deviation to use for the
                            normal distribution used when calculating phi.
                            Too low standard deviation might result in
                            too much sensitivity for sudden, but normal,
                            deviations in event inter arrival times
    4. *acceptable_heartbeat_pause* : Duration (ms) corresponding to
                                    number of potentially lost/delayed
                                    events that will be accepted before
                                    considering it to be an anomaly.
                                    This margin is important to be able to
                                    survive sudden, occasional, pauses in
                                    event reports.
    5. *first_heartbeat_estimate* : Bootstrap the event history with intervals
                                    that corresponds to this duration (ms),
                                    with a with rather high standard deviation
                                    (since environment is unknown at the beginning)

3. Reference it:

    ````
    var phi_detector = require('phi-accrual-detector');
    var mock_service_detector = phi_detector.new_detector(threshold,
                                                        max_sample_size,
                                                        min_std_deviation,
                                                        acceptable_heartbeat_pause,
                                                        first_heartbeat_estimate,
                                                        optional_name);
    /**
     * The 'available' event is broadcast when the phi value
     * cross from above to below the threshold value
     */
    mock_service_detector.on('available', function (phi) {
      console.log("Sweet - the service is available!");
    })
    /**
     * The 'unavailable' event is broadcast when the phi value
     * crosses from below to above the threshold value
     */
    mock_service_detector.on('unavailable', function (phi) {
      console.log("Rats - the service has foresaken me");
    })
    ````

4. Record events:

  ````
  var mock_service = setInterval(function() {
    mock_service_detector.signal();
  }, 100);

  ````

See the ./test directory for more samples and associated
graphs to get an idea of Phi measurements.

TODO
===

1. Create HTTP/S service detectors

