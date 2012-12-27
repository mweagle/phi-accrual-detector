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

var util = require('util');
var events = require('events');
var phi = require('../phi');
var _ = require('underscore');

/*****************************************************************************/
// Privates
/*****************************************************************************/

var AVAILABILITY_TIMEOUT_MULTIPLE = 5;

/**
 * Sampling detector adapts a function (either sync or async) into one that
 * can drive a phi-detector.  The following function signatures are allowed:
 *   function():Boolean
 *   function(callback):Undefined, where callback is the standard
 *                                 callback(error, result) signature.
 *  The async form is considered to have "signaled" if there is no error AND
 *  the result is a "truthy" value.
 *
 * @param {Function} sampling_function function():Boolean or function(callback(e, result)):Undefined
 *                                     that is periodically called to determine if a provider
 *                                     is available
 * @param {Number} interval_ms       Frequency with which sampling_function() should
 *                                   be called
 * @param {Object} phi_detector      phi detector object that the results of the
 *                                   sampling_function should be directed.
 */
var SamplingDetector = function(sampling_function, interval_ms, phi_detector)
{
  events.EventEmitter.call(this);

  this._sampling_function = sampling_function;
  this._interval_ms = interval_ms;
  this._phi_detector = phi_detector;
  this._phi_detector.on('available', this._on_available.bind(this));
  this._phi_detector.on('unavailable', this._on_unavailable.bind(this));

  this._cached_availability =  this._phi_detector.is_available();
  // Setup a timeout that manages checking the availability and
  // can therefore broadcast state changes in the absence of signaling
  // events
  this._on_availability_check();

  this._timeout_id = setTimeout(this._on_sample.bind(this), interval_ms);
  var self = this;

  // Accessors
  Object.defineProperty(this, 'phi', {
                                      get :function () {
                                        return self._phi_detector.phi();
                                      }});
  Object.defineProperty(this, 'settings', {
                                      get :function () {
                                        return self._phi_detector.settings;
                                      }});



};
util.inherits(SamplingDetector, events.EventEmitter);

SamplingDetector.prototype.is_available = function()
{
  return this._phi_detector.is_available();
};

SamplingDetector.prototype._on_availability_check = function()
{
  var now_available = this.is_available();
  if (this._cached_availability && !now_available)
  {
    this._on_unavailable(this._phi_detector.phi());
  }
  else if (!this._cached_availability && now_available)
  {
    this._on_available(this._phi_detector.phi());
  }
  this._cached_availability = now_available;
  // Repeat
  this._availability_timeout_id = setTimeout(this._on_availability_check.bind(this),
                                            AVAILABILITY_TIMEOUT_MULTIPLE * this._interval_ms);
};

SamplingDetector.prototype._on_available = function(phi)
{
  this.emit('available', phi);
};

SamplingDetector.prototype._on_unavailable = function(phi)
{
  this.emit('unavailable', phi);
};

SamplingDetector.prototype._on_sample = function()
{
  try
  {
    var self = this;
    if (this._sampling_function.length > 0)
    {
      var on_sample_result = function(error, result)
      {
        if (!error && result)
        {
          self._phi_detector.signal();
        }
        self._timeout_id = setTimeout(self._on_sample.bind(self),
                                      self._interval_ms);
        // In case an event listener
        // wants to stop the polling loop we emit
        // after assigning the new timeoutID
        self.emit('sample');
      };
      this._sampling_function(on_sample_result);
    }
    else
    {
      try
      {
        if (this._sampling_function())
        {
          self._phi_detector.signal();
        }
        else
        {
        }
      }
      catch (e)
      {

      }
      this._timeout_id = setTimeout(this._on_sample.bind(this),
                                    this._interval_ms);
      this.emit('sample');
    }
  }
  catch (e)
  {
    console.log("ERROR: " + e);
    // No signaling, but keep trying...
    this._timeout_id = setTimeout(this._on_sample.bind(this),
                                  this.interval_ms);
  }
};

SamplingDetector.prototype.stop = function()
{
  if (this._timeout_id)
  {
    clearTimeout(this._timeout_id);
    this._timeout_id = null;
  }
};

/*****************************************************************************/
// Exports
/*****************************************************************************/

/**
 * Create a new sampling detector using the supplied arguments.  Two forms
 * are allowed:
 * (sampling_function,
      sampling_frequency_ms,
      phi_detector_object)
 * OR:
 * (sampling_function,
      sampling_frequency_ms,
      threshold_or_phi_detector,
      max_sample_size,
      min_std_deviation,
      acceptable_heartbeat_pause_ms,
      first_heartbeat_estimate_ms,
      optional_name)
 * @param  {Function} sampling_function           Sampling function to call.
 *                                                Function supports two signatures:
 *                                                  sampling_function():Boolean [sync]
 *                                                  sampling_function(callback):Undefined [async]
 * @param  {Number} sampling_frequency_ms         Frequency with which sampling_function should be
 *                                                called
 * @param  {Number/Object} threshold_or_phi_detector  Either a phi_threshold or a phi_detector object.
 * @param  {Number} max_sample_size               Max samples to use for phi calculation.
 *                                                May be undefined if phi_detector is provided.
 * @param  {Number} min_std_deviation             Minimum standard deviation of readings
 *                                                May be undefined if phi_detector is provided.
 * @param  {Number} acceptable_heartbeat_pause_ms Duration (ms) corresponding to the
                                                  number of potentially lost/delayed
                                                  events that will be accepted before
                                                  it is considered anomalous.
 *                                                May be undefined if phi_detector is provided.
 * @param  {Number} first_heartbeat_estimate_ms   Duration (ms) values with which to bootstrap
 *                                                the event history.
 *                                                May be undefined if phi_detector is provided.
 * @param  {String} optional_name                 Optional name for phi_detector.
 *                                                May be undefined if phi_detector is provided.
 * @return {Object}                               A new SamplingDetector object
 */
module.exports.new_sampling_detector = function(sampling_function,
                                                sampling_frequency_ms,
                                                threshold_or_phi_detector,
                                                max_sample_size,
                                                min_std_deviation,
                                                acceptable_heartbeat_pause_ms,
                                                first_heartbeat_estimate_ms,
                                                optional_name)
{
  var phi_detector = _.isObject(threshold_or_phi_detector) ?
                      threshold_or_phi_detector : null;
  if (!phi_detector)
  {
    phi_detector = phi.new_detector(threshold_or_phi_detector,
                                    max_sample_size,
                                    min_std_deviation,
                                    acceptable_heartbeat_pause_ms,
                                    first_heartbeat_estimate_ms,
                                    optional_name);
  }
  return new SamplingDetector(sampling_function,
                              sampling_frequency_ms,
                              phi_detector);
};

