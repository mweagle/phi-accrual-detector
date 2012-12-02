phi-accrual-detector
====================

What Is It?
===

This is a port of
[Akka's Accrual Failure Detector](https://github.com/akka/akka/blob/master/akka-cluster/src/main/scala/akka/cluster/AccrualFailureDetector.scala)
to [Node.js](http://nodejs.org).  It is an implementation of "The Phi Accrual Failure Detector"
by Hayashibara et al. as defined in their [paper](http://ddg.jaist.ac.jp/pub/HDY+04.pdf).

Why Use It?
===

The phi accrual detector provides a configurable, continuous
"suspicion of failure" value for remote systems whose
availability is indicated by periodic sampling.
The Phi value can help answer questions like:

   * Is some HTTP server up?
   * Did that out-of-process job handler crash?

The standard example is an event source that suddenly
[stops sending events](http://htmlpreview.github.com/?https://github.com/mweagle/phi-accrual-detector/blob/master/test/charts/unreliable-source.html).

The suspicion level adjusts to the recorded event intervals, which makes it
more resilient to event sources that [sawtooth](http://htmlpreview.github.com/?https://github.com/mweagle/phi-accrual-detector/blob/master/test/charts/degrading-source.html)
into stability.

More examples:

* [Reliable Source](http://htmlpreview.github.com/?https://github.com/mweagle/phi-accrual-detector/blob/master/test/charts/reliable-source.html)
* [Source with Normal Event Frequency Distributionn](http://htmlpreview.github.com/?https://github.com/mweagle/phi-accrual-detector/blob/master/test/charts/normal-distribution-source.html)

How to Use It
===

1. Install: `npm install phi-accrual-detector`
2. Determine the configuration settings.  The documentation below is largely
copied from the [Akka source](https://github.com/akka/akka/blob/master/akka-cluster/src/main/scala/akka/cluster/AccrualFailureDetector.scala#L38).
The specific settings depend on your application.
    1. *threshold* : The suspicion level above which the event source
                    is considered to have failed.
    2. *max_sample_size* : The maximum number of samples to store
                            for mean and standard deviation calculations
                            of event reports.
    3. *min_std_deviation* : Minimum standard deviation for the
                            normal distribution used when calculating phi.
                            Too low a standard deviation might result in
                            too much sensitivity for sudden, but normal,
                            deviations in event intervals.
    4. *acceptable_heartbeat_pause* : Duration (ms) corresponding to the
                                    number of potentially lost/delayed
                                    events that will be accepted before
                                    it is considered anomalous.
                                    This margin is important for surviving
                                    sudden, occasional, gaps between
                                    event reports.
    5. *first_heartbeat_estimate* : Duration (ms) values with which to bootstrap the event
                                    history.  They are recorded with
                                    rather high standard deviation
                                    since the environment is unknown at initialization.

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
      console.log("Rats - the service has forsaken me");
    })
    ````

4. Record events:

  ````
  var mock_service = setInterval(function() {
    mock_service_detector.signal();
  }, 100);

  ````

See the ./test directory for more samples and associated
graphs to get an idea of phi behavior.

To Do
===

1. Create HTTP/S service detectors

