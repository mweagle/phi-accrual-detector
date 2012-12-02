// Copyright (c) 2012 Matt Weagle (mweagle@gmail.com)

// Permission is hereby granted, free of charge, to
// any person obtaining a copy of this software and
// associated documentation files (the "Software"),
// to deal in the Software without restriction,
// including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so,
// subject to the following conditions:

// The above copyright notice and this permission
// notice shall be included in all copies or substantial
// portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
// ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
// TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
// SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
// CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
// IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var util = require('util');
var phi = require('../lib/phi.js');
var _ = require('underscore');
var d3 = require('d3');

var CHART_OUTPUT_DIR = path.join(__dirname, 'charts');
var CHART_TEMPLATE_PATH = path.join(__dirname, 'chart.template.erb');
/**
As graphing inifinity is difficult, set an arbitrary
upper bound as a multiple of the threshold for visualization
*/
var CEILING_COEFFICIENT = 10;
/**
Number of events to generate for a test
*/
var SAMPLE_SIZE = 50;

describe('Phi', function() {
  this.timeout(200000);

  /**
   * Accumulate the data for plotting
   */
  var chart_template = null;
  var phi_detector = null;
  var readings = null;
  var sampling_id = null;
  var chart_notes = null;
  var test_start_time = null;

  /////////////////////////////////////////////////////////////////////////////
  // SETUP
  var new_test_detector = function(threshold,
                                        max_sample_size,
                                        min_std_deviation,
                                        acceptable_heartbeat_pause,
                                        first_heartbeat_estimate,
                                        optional_name)
  {
    phi_detector = phi.new_detector(threshold,
                                        max_sample_size,
                                        min_std_deviation,
                                        acceptable_heartbeat_pause,
                                        first_heartbeat_estimate,
                                        optional_name);
    phi_detector.on('available', function (phi) {
      var message = util.format("Service [%s] is available (phi: %d)", phi_detector.name, phi);
      console.log(message);
    });
    phi_detector.on('unavailable', function (phi) {
      var message = util.format("Service [%s] is unavailable (phi: %d)", phi_detector.name, phi);
      console.log(message);
    });

    // Sampling loop
    sampling_id = setInterval(function () {
      // Arbitrarily cap the maximum at 10 * threshold just so that we can
      // graph it...
      var delta = process.hrtime(test_start_time);
      var ts = Math.floor(delta[0] * 1000 + delta[1]/1000000);
      var phi_value = phi_detector.phi().toPrecision(6);
      var clamped_infinity = CEILING_COEFFICIENT * phi_detector.threshold;
      readings.push([ts, Math.min(phi_value, clamped_infinity)]);
    }, 100);
    return phi_detector;
  };

  /////////////////////////////////////////////////////////////////////////////
  // SETUP
  //
  before(function() {
    // Clean it out...
    fs.existsSync(CHART_OUTPUT_DIR) || fs.rmdirSync(CHART_OUTPUT_DIR);
    // And load up the chart template
    chart_template = _.template(fs.readFileSync(CHART_TEMPLATE_PATH, 'UTF-8'));
  });

  after(function() {

  });

  beforeEach(function() {
    console.log("Starting test");
    if (phi_detector)
    {
      phi_detector.removeAllListeners();
      phi_detector = null;
    }
    test_start_time = process.hrtime();
    readings = [];
    chart_notes = null;
  });

  afterEach(function (done) {
    // Cleanup
    if (sampling_id)
    {
      clearInterval(sampling_id);
      sampling_id = null;
    }

    // Create the output file
    if (phi_detector)
    {
      var phi_settings = phi_detector.settings;
      var chart_data = '';
      // title...
      var title = ['Time', 'φ Value', 'Threshold', 'Clamped Infinity'];
      chart_data += JSON.stringify(title);
      // data...
      var clamped_infinity = CEILING_COEFFICIENT * phi_detector.threshold;
      chart_data += _.reduce(readings,
                      function (accumulator, eachReading) {
                        var entry = [eachReading[0],
                                      eachReading[1],
                                      phi_settings.threshold,
                                      clamped_infinity];
                        accumulator += util.format(",\n%s", JSON.stringify(entry));
                        return accumulator;
                      },
                      "");

      // Template it
      var template_data = {
        TITLE: phi_detector.name,
        DATA: chart_data,
        NOTES: chart_notes || ''
      };
      var output_file = path.join(CHART_OUTPUT_DIR, phi_detector.name + ".html");
      fs.writeFile(output_file, chart_template(template_data), done);

      // Dispose of the detector
      phi_detector.removeAllListeners();
      phi_detector = null;
    }
    else
    {
      done();
    }
  });

  /////////////////////////////////////////////////////////////////////////////
  // TESTS
  //
  it ('MUST succeed on a reliable source', function(done) {
    var sample_count = SAMPLE_SIZE;
    var interval = setInterval(function () {
      phi_detector.signal();
      sample_count--;
      if (sample_count <= 0)
      {
        clearInterval(interval);
        var error = phi_detector.unavailable ?
                    new Error("Reliable source false unavailability") : null;
        done(error);
      }
    }, 60);
    phi_detector = new_test_detector(8, 100, 10, 2, 60, 'reliable-source');
  });

  it ('MUST fail on a reliable source dying', function(done) {
    var sample_count = SAMPLE_SIZE;
    var source_died = false;
    var interval = setInterval(function () {
      if (sample_count >= SAMPLE_SIZE/2)
      {
        phi_detector.signal();
      }
      else if (!source_died)
      {
        var now_time = process.hrtime(test_start_time);
        var ts = Math.floor(now_time[0] * 1000 + now_time[1]/1000000);
        chart_notes = util.format("Source stopped sending data at: %s", ts);
        source_died = true;
      }
      sample_count--;
      if (sample_count <= 0)
      {
        clearInterval(interval);
        var error = phi_detector.available ?
                    new Error("Dead source false availability") : null;
        done(error);
      }
    }, 60);
    phi_detector = new_test_detector(8, 100, 20, 10, 60, 'unreliable-source');
  });

  it ('MUST tolerate normal distribution signalers', function(done) {
    var sample_count = SAMPLE_SIZE;
    var normal_function = d3.random.normal(100, 30);

    var signal_handler = function onEvent()
    {
      sample_count--;
      if (sample_count <= 0)
      {
        done();
      }
      else
      {
        phi_detector.signal();
        setTimeout(signal_handler, normal_function());
      }
    };
    setTimeout(signal_handler, normal_function());
    phi_detector = new_test_detector(3, 100, 30, 0, 100, 'normal-distribution-source');
  });

  it ('SHOULD exhibit a dampening sawtooth', function(done) {
    var sample_count = 20;
    var period = 32;
    var signal_handler = function onEvent()
    {
      sample_count--;
      if (sample_count <= 0)
      {
        done();
      }
      else
      {
        period = Math.min(4000, period + (period / 2));
        phi_detector.signal();
        setTimeout(signal_handler, period);
      }
    };
    setTimeout(signal_handler, period);
    phi_detector = new_test_detector(1, 100, 10, 5, 32, 'degrading-source');
  });

});