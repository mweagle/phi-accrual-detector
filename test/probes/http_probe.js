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

var http_probe = require('../../lib/probes/http_probe');
var phi = require('../../lib/phi');

describe('HTTP Sampling Detectors', function() {
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
  it ('MUST handle URL strings', function(done) {
    var sample_count = 20;
    var probe = http_probe.new_http_service_probe("http://www.google.com",
                                                  80,
                                                  3,
                                                  10,
                                                  20);

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

  it ('MUST handle HTTP options objects', function(done) {
    var sample_count = 20;
    var http_options = {
      method: 'HEAD',
      hostname: 'www.google.com',
      path :'/'
    };
    var probe = http_probe.new_http_service_probe(http_options,
                                                  80,
                                                  3,
                                                  10,
                                                  20);

    probe.on('sample', function onSample() {
      sample_count -= 1;
      if (sample_count <= 0)
      {
        probe.stop();
        probe.removeListener('sample', onSample);
        var error = probe.is_available() ? null : new Error("Server should be available");
        done(error);
      }
    });
  });
});