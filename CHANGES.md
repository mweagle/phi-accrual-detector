## Version 0.0.4

 * Added SamplingDetector object
 * Added HTTP and Synchronous probes to simplify binding phi values to functions
 * Fix latent bug where phi.available was improperly cached
 * Move 'available' and 'unavailable' event broadcasts to `phi.signal()`.  Previously this was done in the `phi()` call, but querying a value shouldn't propagate an event.  Note that this means you will not receive 'unavailable' events for sources that stop sending events.  Either use a sampling_detector instance or poll the `phi.is_available()` result to handle this case.
 * Change test output directory

## Version 0.0.3

 * Initial Release