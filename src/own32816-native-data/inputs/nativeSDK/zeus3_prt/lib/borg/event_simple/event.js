var borgevent;
(function (borgevent) {
    /**
     * The Event class is the base class for event classes that are dispatched by IEventDispatchers. The Event class implements the IEvent class.
     *
     * The easiest way for an event class to gain the ability to be dispatched by IEventDispatchers is to extend the Event class. Alternatively any class can implement the IEvent interface.
     */
    var Event = (function () {
        /**
        * @param eventName The type of event.
        */
        function Event(eventName) {
            this.eventName = eventName;
        }
        return Event;
    })();
    borgevent.Event = Event;
})(borgevent || (borgevent = {}));
var borgevent;
(function (borgevent) {
    /**
     * The EventDispatcher class is the base class for all classes that dispatch events. The EventDispatcher class implements the IEventDispatcher interface and is the base class for the DisplayObject class. The EventDispatcher class allows any object to be an event target and
     * as such, to use the methods of the IEventDispatcher interface.
     *
     * Event listeners are an important part of the event model. The event listeners serves as the focal point for how events flow through the hierarchy. When an event such as a mouse click or a keypress occurs, an event object is dispatched into the event flow.
     * When an event is dispatched each listener function is executed within the specified listener context. Each event may have several listener functions which are executed in the order they were added.
     *
     * The easiest way for a class to gain event dispatching abilities is to extend the EventDispatcher class. Alternatively any class can implement the IEventDispatcher interface.
     */
    var EventDispatcher = (function () {
        function EventDispatcher() {
            this._eventNames = [];
            this._listeners = [];
            this._listenerContexts = [];
        }
        /**
         * @inheritdoc
         * @param event @inheritdoc
         */
        EventDispatcher.prototype.dispatchEvent = function (e) {
            var index = this._eventNames.indexOf(e.eventName);
            if (index > -1) {
                var listeners = this._listeners[index].concat();
                var contexts = this._listenerContexts[index].concat();
                for (var i = 0; i < listeners.length; i++) {
                    listeners[i].apply(contexts[i], [e]);
                }
            }
        };
        /**
         * @inheritdoc
         * @param eventName @inheritdoc
         * @param listener @inheritdoc
         * @param listenerContext @inheritdoc
         */
        EventDispatcher.prototype.addEventListener = function (eventName, listener, listenerContext) {
            if (this._eventNames.indexOf(eventName) < 0) {
                this._eventNames.push(eventName);
                this._listeners.push([]);
                this._listenerContexts.push([]);
            }
            var index = this._eventNames.indexOf(eventName);
            this._listeners[index].push(listener);
            this._listenerContexts[index].push(listenerContext);
        };
        /**
         * @inheritdoc
         * @param eventName @inheritdoc
         * @param listener @inheritdoc
         * @param listenerContext @inheritdoc
         */
        EventDispatcher.prototype.removeEventListener = function (eventName, listener, listenerContext) {
            var index = this._eventNames.indexOf(eventName);
            if (index > -1) {
                this._listeners[index].splice(this._listeners[index].indexOf(listener), 1);
                this._listenerContexts[index].splice(this._listenerContexts[index].indexOf(listenerContext), 1);
            }
        };
        return EventDispatcher;
    })();
    borgevent.EventDispatcher = EventDispatcher;
})(borgevent || (borgevent = {}));
