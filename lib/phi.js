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

/**
Port of the Akka AccrualFailureDetector:
https://raw.github.com/akka/akka/master/akka-cluster/src/main/scala/akka/cluster/AccrualFailureDetector.scala

 Which is an implementation of 'The Phi Accrual Failure Detector' by Hayashibara et al.
 as defined in their paper: http://ddg.jaist.ac.jp/pub/HDY+04.pdf
*/
var util = require('util');
var events = require('events');
var assert = require('assert');

/*****************************************************************************/
// Privates
/*****************************************************************************/

var _ms_timestamp = function()
{
  var now_time = process.hrtime();
  return Math.floor((now_time[0] * 1000) + (now_time[1]/1000000));
};

var _log_10 = function(x) {
  return Math.log(x) / Math.LN10;
};

var SignalHistory = function(max_size)
{
  assert(max_size > 1, "History size must be greater than 1");

  this._max_size = max_size;
  this._intervals = [];
  this._interval_sum = 0;
  this._squared_interval_sum = 0;

  // Add the stat aggregators
  var self = this;
  Object.defineProperty(this, 'mean', {
                                      get :function () {
                                        return (self._interval_sum / self._intervals.length);
                                      }});
  Object.defineProperty(this, 'variance', {
                                      get :function () {
                                        return ((self._squared_interval_sum / self._intervals.length) - (self.mean * self.mean));
                                      }});
  Object.defineProperty(this, 'std_deviation', {
                                      get :function () {
                                        return Math.sqrt(self.variance);
                                      }});
  Object.defineProperty(this, 'sample_size', {
                                      get :function () {
                                        return self._intervals.length;
                                      }});
};

SignalHistory.prototype.record = function(interval)
{
  if (this._intervals.length + 1 > this._max_size)
  {
    var dropped_interval = this._intervals.shift();
    this._interval_sum -= dropped_interval;
    this._squared_interval_sum -= (dropped_interval * dropped_interval);
  }
  // Add it...
  this._intervals.push(interval);
  this._interval_sum += interval;
  this._squared_interval_sum += (interval * interval);

  // Chainable
  return this;
};

var AccrualFailureDetector = function (threshold,
                                        max_sample_size,
                                        min_std_deviation,
                                        acceptable_heartbeat_pause_ms,
                                        first_heartbeat_estimate_ms,
                                        optional_name)
{
  assert(threshold > 0.0, "Threshold must be positive");
  assert(max_sample_size > 0, "Sample size must be non-zero");
  assert(min_std_deviation >= 0.0, "Minimum standard deviation must be positive");
  assert(first_heartbeat_estimate_ms > 0.0, "Initial heartbeat value must be positive");

  this._threshold = threshold;
  this._min_std_deviation = min_std_deviation;
  this._acceptable_heartbeat_pause_ms = acceptable_heartbeat_pause_ms;
  this._first_heartbeat_estimate_ms = first_heartbeat_estimate_ms;
  this._last_signal_time = null;
  this._signal_history = new SignalHistory(max_sample_size);
  this._name = optional_name || util.format("phi-detector: threshold (%d), max history (%d), acceptable_pause: (%d), first_estimate: (%d)",
                                            threshold,
                                            max_sample_size,
                                            acceptable_heartbeat_pause_ms,
                                            first_heartbeat_estimate_ms);
  // Add some accessors
  var self = this;
  Object.defineProperty(this, 'name', {value: self._name});
  Object.defineProperty(this, 'threshold', {
                                      get : function () {
                                        return self._threshold;
                                      }});
  Object.defineProperty(this, 'available', {
                                      get : function () {
                                        return self._available;
                                      }});
  Object.defineProperty(this, 'sample_size', {
                                      get : function () {
                                        return self._signal_history.sample_size();
                                      }});
  // Accessor to return all the settings
  Object.defineProperty(this, 'settings', {value : {
    threshold: threshold,
    max_sample_size: max_sample_size,
    min_std_deviation: min_std_deviation,
    acceptable_heartbeat_pause_ms: acceptable_heartbeat_pause_ms,
    first_heartbeat_estimate_ms: first_heartbeat_estimate_ms
  }});
  events.EventEmitter.call(this);
};
util.inherits(AccrualFailureDetector, events.EventEmitter);

/**
 * Function to call when a 'heartbeat' style message has been
 * received.  After calling signal(), the available boolean property
 * indicates whether the unreliable signaller's suspicion
 * level is less than the threshold
 *
 * @return {Undefined} No return value
 */
AccrualFailureDetector.prototype.signal = function()
{
  if (this._signal_history.sample_size <= 0)
  {
    // bootstrap with 2 entries with rather high standard deviation
    var mean = this._first_heartbeat_estimate_ms;
    var stdDeviation = mean / 4;
    this._signal_history.record(mean - stdDeviation).record(mean - stdDeviation);
  }
  else
  {
    assert(this._last_signal_time, "Initial signal didn't update history");
    var interval = _ms_timestamp() - this._last_signal_time;
    this._signal_history.record(interval);
  }
  this._last_signal_time = _ms_timestamp();
};

/**
 * The suspicion level of the accrual failure detector.  The
 * suspicion level is 0 for detectors that have not been signaled.
 *
 * The object will also broadcast events when availability
 * transitions occur:
 *   'unavailable' : When the service transitions from available
 *                   to unavailable
 *   'available'   : When the service transitions from unavailable
 *                   to available
 * @return {Number} Suspicion level (0.0 <= φ)
 */
AccrualFailureDetector.prototype.phi = function()
{
  if (!this._last_signal_time)
  {
    // Asking for the suspicion level without having
    // indicated a signal is treated as a success
    return  0.0;
  }
  else
  {
    var delta = _ms_timestamp() - this._last_signal_time;
    var std_deviation =
      this._ensureValidStdDeviation(this._signal_history.std_deviation);
    var φ = this._phi(delta,
                      this._signal_history.mean + this._acceptable_heartbeat_pause_ms,
                      std_deviation);

    var next_available = (φ <= this._threshold);
    if (this._available &&
        !next_available)
    {
      this.emit('unavailable', φ);
    }
    else if (!this._available &&
            next_available)
    {
      this.emit('available', φ);
    }
    this._available = next_available;
    return φ;
  }
};

/**
 * Cumulative distribution function from N(mean, stdDeviation) normal distribution
 * This is an approximation defined in β Mathematics Handbook
 * @param  {Number} x             Value
 * @param  {Number} mean          Mean
 * @param  {Number} std_deviation Standard deviation
 * @return {Number}               CDF
 */
AccrualFailureDetector.prototype._cumulative_distribution_fn = function(x, mean, std_deviation)
{
  var y = (x - mean) / std_deviation;
  // Cumulative distribution function for N(0, 1)
  return (1.0 /(1.0 + Math.exp(-y * (1.5976 + 0.070566 * y * y))));
};

AccrualFailureDetector.prototype._ensureValidStdDeviation = function(std_deviation)
{
  return Math.max(std_deviation, this._min_std_deviation);
};

AccrualFailureDetector.prototype._phi = function (time_diff, mean, std_deviation)
{
  var cdf = this._cumulative_distribution_fn(time_diff, mean, std_deviation);
  return (-_log_10(1.0 - cdf));
};


/*****************************************************************************/
// Exports
/*****************************************************************************/
module.exports.new_detector = function (threshold,
                                        max_sample_size,
                                        min_std_deviation,
                                        acceptable_heartbeat_pause,
                                        first_heartbeat_estimate,
                                        optional_name)
{
  return new AccrualFailureDetector(threshold,
                                        max_sample_size,
                                        min_std_deviation,
                                        acceptable_heartbeat_pause,
                                        first_heartbeat_estimate,
                                        optional_name);
};


