/*
 * jquery.ajax-retry
 * https://github.com/johnkpaul/jquery-ajax-retry
 *
 * Copyright (c) 2012 John Paul
 * Licensed under the MIT license.
 */
var $ = require('jquery');

// enhance all ajax requests with our retry API
$.ajaxPrefilter(function(options, originalOptions, jqXHR) {
  jqXHR.retry = function(opts) {
    if (opts.statusCodes) {
      this.statusCodes = opts.statusCodes;
    }

    // alias for jqXHR `abort()` method
    var promise = this.then(null, pipeFailRetry(this, opts));
    promise.abort = function (statusText) { jqXHR.abort(statusText) };

    return promise;
  };
});

// generates a fail pipe function that will retry `jqXHR` `times` more times
function pipeFailRetry(jqXHR, opts) {
  var times = opts.times;
  var timeout = opts.timeout;

  // takes failure data as input, returns a new deferred
  return function(input, status, msg) {
    var ajaxOptions = this;
    var output = new $.Deferred();
    var nextJqXHR;
    var retryAfter = jqXHR.getResponseHeader('Retry-After');

    // whenever we do make this request, pipe its output to our deferred
    function nextRequest() {
      nextJqXHR = $.ajax(ajaxOptions)
        .retry({times: times - 1, timeout: opts.timeout, statusCodes: opts.statusCodes})
        .then(output.resolve, output.reject);
    }

    if (times > 1 && (!jqXHR.statusCodes || $.inArray(input.status, jqXHR.statusCodes) > -1)) {
      // implement Retry-After rfc
      // http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.37
      if (retryAfter) {
        // it must be a date
        if (isNaN(retryAfter)) {
          timeout = new Date(retryAfter).getTime() - $.now();
        // its a number in seconds
        } else {
          timeout = parseInt(retryAfter, 10) * 1000;
        }
        // ensure timeout is a positive number
        if (isNaN(timeout) || timeout < 0) {
          timeout = opts.timeout;
        }
      }

      if (timeout !== undefined){
        setTimeout(nextRequest, timeout);
      } else {
        nextRequest();
      }
    } else {
      // no times left, reject our deferred with the current arguments
      output.rejectWith(this, arguments);
    }

    return output;
  };
}
