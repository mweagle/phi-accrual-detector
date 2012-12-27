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
//
var synchronous_probe = require('../../lib/probes/synchronous_probe');

var SYNCHRONOUS_SAMPLE_COUNT = 20;

describe('Synchronous Sampling Detectors', function() {
  this.timeout(200000);

  /////////////////////////////////////////////////////////////////////////////
  // SETUP
  //
  before(function() {

  });

  after(function() {

  });

  beforeEach(function() {

  });

  afterEach(function (done) {
    done();
  });

  /////////////////////////////////////////////////////////////////////////////
  // TESTS
  //
  it ('MUST handle synchronous probes', function(done) {
    console.log("Starting succeeding synchronous probe");

    var sample_count = SYNCHRONOUS_SAMPLE_COUNT;

    var sampling_method = function ()
    {
      return true;
    };
    var probe = synchronous_probe.new_synchronous_probe(sampling_method,
                                                        100,
                                                        10,
                                                        10,
                                                        2);

    probe.on('sample', function onSample() {
      sample_count -= 1;
      if (sample_count <= 0)
      {
        probe.stop();
        var error = probe.is_available() ? null : new Error("Server should be available");
        done(error);
      }
    });
  });

  it ('MUST handle synchronous probes that fail', function(done) {
    console.log("Starting failing synchronous probe");
    var sample_count = SYNCHRONOUS_SAMPLE_COUNT;
    var fail_count = 0.9 * SYNCHRONOUS_SAMPLE_COUNT;

   var failing_sample_method = function ()
    {
      return (sample_count >= fail_count);
    };
    var probe = synchronous_probe.new_synchronous_probe(failing_sample_method,
                                                        100,
                                                        10,
                                                        10,
                                                        2);
    probe.on('unavailable', function (phi) {
      console.log("Service unavailable event handled.  Phi level: " + phi);
    });
    probe.on('sample', function onSample() {
      console.log("Sample recorded.  Phi level: " + probe.phi);

      sample_count -= 1;
      if (sample_count <= 0)
      {
        probe.stop();
        var error = !probe.is_available() ? null : new Error("Server should NOT be available");
        done(error);
      }
    });
  });
});
