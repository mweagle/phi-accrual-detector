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
var sampling_detector = require('../detector/sampling_detector');
var http = require('http');
var https = require('https');
var url = require('url');
var _ = require('underscore');
var util = require('util');

/*****************************************************************************/
// Privates
/*****************************************************************************/

/*****************************************************************************/
// Exports
/*****************************************************************************/

/**
 * Create a new HTTP service probe for the given URL string or
 * HTTP options object.
 * @param  {Object/String} url_string_or_http_options Either a URL string or a URL
 *                                                    options object to use for the
 *                                                    query.
 * @param  {Number} frequency_ms               Frequency (in MS) with which to check
 *                                             the HTTP service
 * @param  {Number} threshold                  The threshold above which the HTTP
 *                                             service is considered to have failed
 * @param  {Number} max_sample_size            Maximum number of samples to retain
 * @param  {number} min_std_deviation          Minimum std deviation
 * @return {Object}                            A SamplingDetector object that uses this
 *                                             HTTP source as its datasource.
 */
module.exports.new_http_service_probe = function(url_string_or_http_options,
                                                    frequency_ms,
                                                    threshold,
                                                    max_sample_size,
                                                    min_std_deviation)
{
  var request_options = _.isObject(url_string_or_http_options) ?
                          url_string_or_http_options :
                          url.parse(url_string_or_http_options, true);
  // Protocol sniffing
  var is_https = _.isString(url_string_or_http_options) ?
                    (url_string_or_http_options.toLowerCase().indexOf('https') >= 0) :
                    url_string_or_http_options.protocol === 'https';

  var request_handler  = is_https ? https.request : http.request;
  var http_s_probe = function(callback)
  {
    var on_response = function(http_result)
    {
      callback(null, http_result &&
                             http_result.statusCode >= 200 &&
                             http_result.statusCode <= 299 );
    };
    var issued_request = request_handler(request_options, on_response);
    issued_request.once('socket', function onSocket (socket) {
      socket.on('error', function onSocketError (e) {
        callback(e, null);
      });
    });
    issued_request.once('error', function onRequestError (e) {
        callback(e, null);
    });
    issued_request.end();
  };
  return sampling_detector.new_sampling_detector(http_s_probe,
                                                  frequency_ms,
                                                  threshold,
                                                  max_sample_size,
                                                  min_std_deviation,
                                                  frequency_ms, /* Skip 1 */
                                                  frequency_ms);
};
