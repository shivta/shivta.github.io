// Drag.Splitter is an extension to the base class with additional functionality for dragging a splitter in a split view.
// The splitter must be located between firstElement and secondElement. If the splitter is dragged, both elements will be resized.
// Set isVertical in options to true if the split bar is vertical (subviews are side by side) or false if it is horizontal (views are one on top of the other).
Drag.Splitter = new Class({
Extends: Drag,

initialize: function(splitter, firstElement, secondElement, options){
    var newOptions = Object.merge({
    firstPartMinSize:     0.0,     // The min size for the first part.
    secondPartMinSize:     0.0,     // The min size for the second part.
    isVertical:         true,    // See main comment
    handle:                splitter // Never set handle yourself in options.
        }, options)

    if(newOptions.isVertical) {
        this.property = 'width';
        newOptions.modifiers = {x: this.property, y: ''};
    } else {
        this.property = 'height';
        newOptions.modifiers = {x: '', y: this.property};
    }
    this.parent(firstElement, newOptions);
    this.secondElement = secondElement;
},

dispose: function() {
    this.firstPartMouseWheelObserver.dispose();
    this.firstPartMouseWheelObserver = null;
    this.secondPartMouseWheelObserver.dispose();
    this.secondPartMouseWheelObserver = null;
    //console.log('dispose Drag.Splitter');
},

    // Returns the axis the splitter is dragged on.
axis: function(){
    return this.options.isVertical ? 'x' : 'y';
},

    // Sets the minimum and maximum positions of the splitter.
updateLimits: function() {
    var axis      = this.axis();
    var splitter  = this.options.handle;
    this.netValue = this.element.getSize()[axis] + this.secondElement.getSize()[axis];
    var isInsideFirstElement = splitter.getParent()==this.element;
    var splitterSize = splitter.getSize()[axis];
    var minValue  = isInsideFirstElement ? splitterSize : 0.0;
    this.options.limit = {};
    var more = 0.0;
    if(!isInsideFirstElement)
        more -= splitterSize
        this.options.limit[axis] = [minValue, this.netValue + more];

    // this.limit is used while dragging.
    if(this.limit)
        this.limit[axis] = this.options.limit[axis];
},

    // Sets the max and min position of the splitter and then calls the base class implementation
start: function(event){
    this.updateLimits();
    this.parent(event);
},

    // Resizes element to size and also adjusts the size of the second element.
resizeElements: function(size, property, unit){
    var firstPartMinSize  = this.options.firstPartMinSize;
    var secondPartMinSize = this.options.secondPartMinSize;

    var oldSize;
    var oldSecondSize;
    var secondSize    = this.netValue-size;

    // To minimize layouts we do not get the size from the elements only if needed.
    if(firstPartMinSize > 0 || secondPartMinSize > 0)
    {
        var axis      = this.axis();
        oldSize       = this.element.getSize()[axis];
        oldSecondSize = this.secondElement.getSize()[axis];
    }

    if((size <= 1 || size >= firstPartMinSize) && (secondSize <= 1 || secondSize >= secondPartMinSize))
    {
        // In case a min size is given to one of the parts and this part is collapsed,
        // resize it to zero. In all other cases stop one pixel before in order to show the splitter.
        if(firstPartMinSize > 0 && size <= 1){
            size = 0.0;
            secondSize = this.netValue;
        }

        if(secondPartMinSize > 0 && secondSize <= 1){
            size = this.netValue;
            secondSize = 0.0;
        }

        // Resize both parts:
        this.secondElement.setStyle(property, secondSize + unit);
        this.element.setStyle(property, size + unit);

        // Send an event if the first part did collapse or expand
        if(firstPartMinSize > 0){
            if(oldSize >= firstPartMinSize && size <= 1)
                this.fireEvent('collapse', [this.element]);
            else if(oldSize <= 1 && size >= firstPartMinSize) {
                this.fireEvent('expand', [this.element]);
                this.updateLimits();
            }
        }

        // Send an event if the second part did collapse or expand
        if(secondPartMinSize > 0){
            if(oldSecondSize >= secondPartMinSize && secondSize <= 1)
                this.fireEvent('collapse', [this.secondElement]);
            else if(oldSecondSize <= 1 && secondSize >= secondPartMinSize) {
                this.fireEvent('expand', [this.secondElement]);
                this.updateLimits();
            }
        }
    }
},

    // The drag method is overwritten from Drag in order to resize the first and second element after the splitter position has changed.
drag: function(event){
    var options = this.options;

    if (options.preventDefault) event.preventDefault();
    this.mouse.now = event.page;

    for (var z in options.modifiers){
        if (!options.modifiers[z]) continue;
        this.value.now[z] = this.mouse.now[z] - this.mouse.pos[z];

        if (options.invert) this.value.now[z] *= -1;

        if (options.limit && this.limit[z]){
            if ((this.limit[z][1] || this.limit[z][1] === 0) && (this.value.now[z] > this.limit[z][1])){
                this.value.now[z] = this.limit[z][1];
            } else if ((this.limit[z][0] || this.limit[z][0] === 0) && (this.value.now[z] < this.limit[z][0])){
                this.value.now[z] = this.limit[z][0];
            }
        }

        if (options.grid[z]) this.value.now[z] -= ((this.value.now[z] - (this.limit[z][0]||0)) % options.grid[z]);

        // This is the part we have overwritten. Everything above is copied from the original drag implementation.
        if (options.style)
            this.resizeElements(this.value.now[z], options.modifiers[z], options.unit);
    }
    this.fireEvent('drag', [this.element, event]);
},

    });


// WBLSplitViewController adds dynamic behavior to a splitview element. It ensures that both parts inside the splitview share the whole
// space of their container by respecting the splitter position. The markup consists of two splitters. One in each part. This is somewhat
// unintuitive. But it is needed, because the split position is given in relative values, but the thickness of the splitter is given
// an absolute value. Until all common browsers accept calc() values in CSS styles we need to do it this way.
//
// Here is an example of a splitview element markup:
//
//        <div id="mySplitView" class="splitview vertical" style="height: 50%; margin: 10px; border: 1px solid #9b9b9b;">
//            <div style="background-color: yellow; width: 30%;">
//                <div class="splitter">
//                    <div class="effectiveSplitter"></div>
//                </div>
//                <div class="contentWrapper">
//                    <pre style="width: 1000px; overflow: hidden;"></pre>
//                </div>
//            </div>
//            <div style="background-color: pink; width: 70%;">
//                <div class="splitter">
//                    <div class="effectiveSplitter"></div>
//                </div>
//                <div class="contentWrapper">
//                    <pre style="width: 1000px; overflow: hidden;"></pre>
//                </div>
//            </div>
//        </div>
//
// If you want a horizontal splitview use <div class="splitview horizontal" ...
// Place the content inside the divs with class "contentWrapper".
//
// Then create a PWSplitViewController for the splitview:
//
//      <script type='text/javascript'>
//          var mySplitView = new PWSplitViewController($('mySplitView'), {}); // For available options see comments below
//      </script>
//

WBLSplitViewController = new Class({
Implements: [Options, Events],
options: {
    // If true and the splitview is vertical syncs the vertical scroll positions in both parts.
    // If true and the splitview is horizontal syncs the horizontal scroll positions in both parts.
    syncScrollPosition: false,

    // If true the scroll position of the content in the second part is applied to the header as well.
    syncSecondPartHeaderScrollPosition: false,

    // If true and the splitview is vertical hides the vertical scroller inside the first part.
    // If true and the splitview is horizontal hides the horizontal scroller inside the first part.
    hideFirstScroller:     false,

    // The min size for the first part.
    firstPartMinSize:     0.0,

    // The min size for the second part.
    secondPartMinSize:     0.0,

    // A string which is put in front of the regular content inside the first iFrame.
    secondPartPreIFrameContent: null,

    // A string which is put after the regular content inside the first iFrame.
    secondPartPostIFrameContent: null,

    // If true, javascript and css is loaded with XMLHTTPRequests to prevent flicker.
    optimizedScriptAndCSSLoadingInIFrames: true,

    secondScrollComponentClass: 'WBLScrollComponentController',

    secondScrollComponentOptions: {},

    splitterDidChangeAction: null

},

initialize: function(splitView, options){
    this.setOptions(options);

    // Add us to the autorelease pool
    PWAutoreleasePool.addObjectToPoolForElement(this, splitView);

    this.splitView       = $(splitView);

    var children         = this.splitView.getChildren();
    this.firstPart       = children[0];
    this.secondPart      = children[1];
    this.isVertical         = this.splitView.hasClass('vertical');

    // Save scrollviews for later use. They must be updated if the splitter position has changed.
    var scrollViews = this.splitView.getElements('.scrollview');

    var me = this;
    if(scrollViews.length > 0) {
        this.firstScrollView = scrollViews[0].scrollViewController;
        window.addEvent('resize', function(event) {
            me.updateScrollViewsLayout();
        });
    }

    if(scrollViews.length > 1)
        this.secondScrollView = scrollViews[1].scrollViewController;

    // Get the hidden form field used to save the splitview state (splitter position etc.)
    this.splitterStateTextField = document.getElementById(splitView.getProperty('id')+'-SplitterState');
    this.firstPart.getSize()[axis];
    var property = this.changeableProperty();
    var axis     = this.axis();
    var size     = this.splitView.getComputedSize()[property];
    size        -= this.firstPart.getSize()[axis];
    this.secondPart.setStyle(property, size);

    // Apply the initial splitter position
    this.applyInitialSplitterPositionIfAvailable();

    this.dragShield      = new PWDragShield((this.isVertical ? 'col-resize' : 'row-resize'));
    this.iFrames         = this.splitView.getElements('iframe');
    this.containsIFrames = this.iFrames.length > 0;

    // Resize the second part to fit into the splitView (respecting the width of the first part)
    this.resizeSecondPartToFit();

    var splitters       = this.splitView.getElements('.splitter');
    this.firstSplitter  = splitters[0];
    this.secondSplitter = splitters[1];
    this.firstDrag      = this.newDragWithSplitter(this.firstSplitter);
    this.secondDrag     = this.newDragWithSplitter(this.secondSplitter);

    // This makes exactly one of the two splitters visible.
    this.makeOneSplitterVisible();

    // Synchronize scroll positions if needed.
    if(this.options.syncScrollPosition)
        this.setupSyncScrollPositions();

    // If options.hideFirstScroller is true but the second view is invisible because the first part
    // fills the whole splitview, adjustFirstScrollerVisibility would show the scroller inside the first part.
    this.adjustFirstScrollerVisibility();
    this.adjustSplitterThickness();

    // On touch enabled devices enlarge the effective splitter:
    if(PWBrowserSupportsTouchEvents())
    {
        this.splitView.getElements('.effectiveSplitter').each(function(effectiveSplitter){
            effectiveSplitter.setStyle('left', '-15px');
            effectiveSplitter.setStyle('width', '31px');
        });
    }

    this.waitUntilScrollviewsAreReady()
},

applyInitialSplitterPositionIfAvailable: function(){

    // Get the hidden form field used to save the splitview state (splitter position etc.)
    this.splitterStateTextField = document.getElementById(this.splitView.getProperty('id')+'-SplitterState');

    var splitterStateString = this.splitterStateTextField.value;
    if(splitterStateString) {
        var regex = new RegExp("'", 'g');
        var JSONString = splitterStateString.replace(regex, '"');
        this.state = eval('('+JSONString+')');
        var collapseState = this.state.collapseState;

        // firstPortion is the relative size of the first part. For example: 0.5 means it takes half of the split view's area.
        var firstPortion = 0.5;
        if(collapseState == 1) // First view is collapsed
            firstPortion = 0.0;
        else if(collapseState == 2) // Second view is collapsed
            firstPortion = 1.0;
        else
            firstPortion = this.state.firstExtent/(this.state.firstExtent+this.state.secondExtent);

        var property = this.changeableProperty();
        var size = this.splitView.getComputedSize()[property];
        this.firstPart.setStyle(property, size * firstPortion);
    }
},

    // Can be overwritten in subclasses. By default this method just waits for the iFrames becomming ready.
waitUntilScrollviewsAreReady: function(){
    if(this.iFrames.length > 0){
        PWWaitUntilDomIsReadyAndIFramesInWindowAreLoaded(window, function(){
            this.setupAfterScrollviewsAreReady();
        }, this);
    }
    else
        this.setupAfterScrollviewsAreReady();
},

    // Can be overwritten in subclasses. At this point in time iFrames are ready to use.
setupAfterScrollviewsAreReady: function(){


},

dispose: function() {
    //console.log('dispose WBLSplitViewController');


    // TODO: maybe we should also remove the event listeners created in setupSyncScrollPositions
    //       But the elements are gone, so we will not get any events.
},

saveState: function(){

    // Currently only the splitter position is saved:
    var axis = this.axis();
    var w1 = Math.round(this.firstPart.getSize()[axis]);
    var w2 = Math.round(this.secondPart.getSize()[axis]);

    var collapseState = 0
    if(w1 == 0)
        collapseState = 1;
    else if(w2 == 0)
        collapseState = 2;

    this.state.collapseState = collapseState;

    // Until we really can collapse the split view inside the browser, we onyl change the extents when not collapsed
    // So we preverse extents in Merlin.
    if(collapseState == 0)
    {
        this.state.firstExtent  = w1;
        this.state.secondExtent = w2;
    }

    var splitterStateString = this.stringFromState(this.state);
    this.splitterStateTextField.value = splitterStateString;

    if(this.options.splitterDidChangeAction)
        this.options.splitterDidChangeAction({splitterState:splitterStateString});
},

stringFromState: function(state)
{
    var result = "{";
    if(this.state.firstExtent)
        result += "'firstExtent':"+state.firstExtent+",";
    if(this.state.secondExtent)
        result += "'secondExtent':"+state.secondExtent+",";
    if(this.state.orientation)
        result += "'orientation':"+state.orientation+",";
    result += "'collapseState':"+state.collapseState+"}";
    return result;
},

updateScrollViewsLayout: function () {
    if(this.firstScrollView)
        this.firstScrollView.updateLayout();
    if(this.secondScrollView)
        this.secondScrollView.updateLayout();
},

    // Creates a new Drag.Splitter object for splitter.
    // Note: A drag objects is created once for each splitter inside the initialize method.
    //       It is not created each time a user starts to drag a splitter.
    // The events like onStart, onComplete etc. are simply forwarded to our controller.
newDragWithSplitter: function (splitter) {
    var controller = this;
    var drag = new Drag.Splitter(splitter, this.firstPart, this.secondPart, {
    isVertical: controller.isVertical,
    firstPartMinSize: controller.options.firstPartMinSize,
    secondPartMinSize: controller.options.secondPartMinSize,

    onBeforeStart:function(){
        controller.onBeforeStartDrag(drag, splitter);
    },

    onStart: function(){
        controller.onStartDrag(drag, splitter);
    },
    onCancel: function(){
        controller.onCancelDrag(drag, splitter);
    },
    onComplete: function(){
        controller.onCompleteDrag(drag, splitter);
    },
    onDrag: function(){
        controller.onDrag(drag, splitter);
    },
    onExpand: function(element){
        controller.onExpand(element);
    },
    onCollapse: function(element){
        controller.onCollapse(element);
    }
        });
    return drag;
},

    // This eliminates some layout differences between browsers.
    // For example: Webkit does not use the whole width for the second part if the first part has 30% and the second part has 70% assigned.
resizeSecondPartToFit: function() {
    var property = this.changeableProperty();
    var axis     = this.axis();
    var size     = this.splitView.getComputedSize()[property];
    size        -= this.firstPart.getSize()[axis];
    this.secondPart.setStyle(property, size);
    this.convertAbsoluteToRelativeValues();
},

    // Resizes the content wrapper so that its size plus the size of the splitter fit into their container.
resizeContentWrapperToFitSplitter: function (splitter) {
    var contentWrapper  = splitter.getParent().getElement('.contentWrapper');
    contentWrapper.setStyle(this.splitterSide(splitter), splitter.getSize()[this.axis()]);
},

    // If options.hideFirstScroller is true but the second view is invisible because the first part
    // fills the whole splitview, this nevertheless shows the scroller inside the first part.
adjustFirstScrollerVisibility: function() {
    if(this.options.hideFirstScroller){
        var displayProperty = this.isVertical ? 'overflow-y' : 'overflow-x';
        var displayValue    = this.isPartCollapsed(this.secondPart) ? 'auto' : 'hidden';

        // If a scrollview is inside the first part, adjust the scroller visibility of its content:
        var contentWrapper
        if(this.firstScrollView){
            contentWrapper = this.firstScrollView.scrollView.getElement('.main.content');
        } else {
            // Otherwise update the scroller visibility of our own content wrapper:
            contentWrapper = this.firstSplitter.getParent().getElement('.contentWrapper');
        }
        contentWrapper.setStyle(displayProperty, displayValue);
        //            this.updateScrollViewsLayout();
    }
},

    // Is called directly after the user has clicked into the splitter
onBeforeStartDrag: function(drag, splitter) {
    this.dragShield.show();
},

    // Is called when a drag starts.
onStartDrag: function(drag, splitter) {
    if(this.delegate)
        this.delegate.splitViewWillMoveSplitter(this);
    this.adjustSplitterThickness();
},

onCancelDrag: function(drag, splitter) {
    this.dragShield.hide();
},

    // Is called after a drag did end.
onCompleteDrag: function(drag, splitter) {
    this.dragShield.hide();

    this.makeOneSplitterVisible();
    this.adjustSplitterThickness();

    // Always remove the moving class, which adds a one pixel border to one side of the splitter
    // during the drag. This border is no longer needed after the drag ended.
    if(splitter.hasClass('bold'))
        splitter.removeClass('moving');

    // Assign relative size values to both parts of the splitview.
    this.convertAbsoluteToRelativeValues();

    // Hide or show the scroller in the first part.
    this.adjustFirstScrollerVisibility();

    this.saveState();

    if(this.delegate)
        this.delegate.splitViewDidMoveSplitter(this);
},

    // Is called during a drag each time the user moves the mouse.
onDrag: function(drag, splitter) {
    // Adds or removes the moving class to the splitter, depending on the splitter position.
    // The moving class adds a one pixel border to one side of the splitter.
    if(splitter.hasClass('bold')) {
        var axis = this.axis();
        var part = splitter==this.secondSplitter ? this.firstPart : this.secondPart;
        if(part.getSize()[axis] > 0.0) {
            splitter.addClass('moving');
            this.resizeContentWrapperToFitSplitter(splitter);
        }else{
            splitter.removeClass('moving');
            this.resizeContentWrapperToFitSplitter(splitter);
        }
    }
    else
        splitter.removeClass('moving');

    // If this splitview contains scrollviews, update their layout:
    //        this.updateScrollViewsLayout();

    if(this.delegate)
        this.delegate.splitViewIsMovingSplitter(this);
},

    // Is called if the size of the part did change from zero to a greater value.
    // This is only called if a minimum size has been assigned to this part.
onExpand: function (part) {
    this.makeOneSplitterVisible();
    this.adjustSplitterThickness();
    this.adjustFirstScrollerVisibility();
},

    // Is called if the size of the part did change from a value greater zero to zero.
    // This is only called if a minimum size has been assigned to this part.
onCollapse: function (part) {
    this.makeOneSplitterVisible();
    this.adjustSplitterThickness();
},

    // Returns the property changed in each part when dragging the splitter.
changeableProperty: function(){
    return this.isVertical ? 'width' : 'height';
},

    // Returns the axis the splitter is dragged on.
axis: function(){
    return this.isVertical ? 'x' : 'y';
},

    // Prepares both content wrappers to synchronize their scroll positions.
    // If this is a vertical splitview scrollTop is synchronized.
    // If this is a horizontal splitview scrollLeft is synchronized.
setupSyncScrollPositions: function(){

    function setupSyncScrollPositions_(){
        var contentWrappers;

        // If we have scrollviews inside, sync their content scrollers:
        if(this.firstScrollView && this.secondScrollView) {
            contentWrappers = [];
            contentWrappers.push(this.firstScrollView.scrollElement());
            contentWrappers.push(this.secondScrollView.scrollElement());
        }else{
            // Otherwise sync the scrollers of our own content wrappers:
            contentWrappers = this.splitView.getElements('.contentWrapper');
        }


        // In Webkit it can happen that a scroll event for an event is triggered after its scrollTop is changed programatically.
        // I never saw this in other browsers. Maybe it is a bug. To workaround it we suppress syncing scrollTop from the part whose
        // scrollTop has currently been changed programatically.
        var timeout = 100; // in ms
        var suppressRightScrollTopSync;
        var suppressRightScrollTopSyncTimeoutID;
        var suppressLeftScrollTopSync;
        var suppressLeftScrollTopSyncTimeoutID;

        var isVertical = this.isVertical;
        var isChrome = PWBrowserIsChrome();

        // Note: in Chrome scrollTop and ScrollLeft does not return a valid value
        // if no scroller is active and the warpper is a body element.
        // So we use getScroll instead. Tgis works in all other browsers too.
        var getNewPosition = function(sourceWrapper, targetWrapper){
            var oldPos = targetWrapper.getScroll();
            var newPos = sourceWrapper.getScroll();
            var oldValue;
            var newValue;
            if(isVertical)
            {
                newPos.x = oldPos.x;
                oldValue = oldPos.y;
                newValue = newPos.y;
            }
            else
            {
                newPos.y = oldPos.y
                oldValue = oldPos.x;
                newValue = newPos.x;
            }
            return {newValue:newValue, oldValue:oldValue, pos:newPos};
        }

        // Note: In Chrome we have to use the scrollTo method for scrolling.
        //       But this does not work well in other browsers.
        var scrollWrapperTo = function(wrapper, pos){
            if(isChrome)
                wrapper.scrollTo(pos.x, pos.y);
            else{
                if(isVertical)
                    wrapper.scrollTop = pos.y;
                else
                    wrapper.scrollLeft = pos.x;
            }
        }

        // Apply the scroll position of the second content wrapper to the first content wrapper.
        var syncLeftScrollAnchor = function(){
            var newPosition = getNewPosition(contentWrappers[1], contentWrappers[0]);
            if(!suppressLeftScrollTopSync &&  newPosition.oldValue != newPosition.newValue){
                suppressRightScrollTopSync = true;
                window.clearTimeout(suppressRightScrollTopSyncTimeoutID);
                suppressRightScrollTopSyncTimeoutID =  window.setTimeout(function(msg) {suppressRightScrollTopSync = false;}, timeout);
                scrollWrapperTo(contentWrappers[0], newPosition.pos);
            }
        }

        // Apply the scroll position of the first content wrapper to the second content wrapper.
        var syncRightScrollAnchor = function(){
            var newPosition = getNewPosition(contentWrappers[0], contentWrappers[1]);
            if(!suppressRightScrollTopSync &&  newPosition.oldValue != newPosition.newValue){
                suppressLeftScrollTopSync = true;
                window.clearTimeout(suppressLeftScrollTopSyncTimeoutID);
                suppressLeftScrollTopSyncTimeoutID =  window.setTimeout(function(msg) {suppressLeftScrollTopSync = false;}, timeout);
                scrollWrapperTo(contentWrappers[1], newPosition.pos);
            }
        }

        // Uses mouse wheel events to change the scroll position of an element.
        // This is needed if the scroller inside the first content wrapper is hidden (options.hideFirstScroller = true).
        var doMouseWheel = function(deltas, element) {
            // If we scroll the body and the scroll bar is not visible,
            // setting scrollTop or scrollLeft in Chrome has no effect.
            if (isChrome && PWElementIsBody(element)){
                // Note: scrollTo does not work as expected
                element.getWindow().scrollBy(-deltas.x, -deltas.y);
            }else{
                element.scrollTop  -= deltas.y;
                element.scrollLeft -= deltas.x;
            }
        }

        var supportTouchEvents = PWBrowserSupportsTouchEvents();
        var iOS = PWBrowserIsIOS();

        // Attach the 'mousewheel' event handler to the first content wrapper.
        if(this.options.hideFirstScroller == true) {
            var scrollElement1 = contentWrappers[0];
            // Respond to touch events on mobile browsers.
            var eventElement1 = this.containsIFrames && iOS && supportTouchEvents ? this.iFrames[0].contentDocument.defaultView : scrollElement1;
            this.firstPartMouseWheelObserver = new PWMouseWheelObserver(eventElement1, function(element, deltas){
                doMouseWheel(deltas, scrollElement1);
                syncRightScrollAnchor();
            }, this);
        }

        // Attach the 'scroll' event handler to the first content wrapper.
        if(this.containsIFrames && !PWBrowserIsIOS())
            // In webkit, where we use iFrames, we need to listen to the scroll event of the default view (which is the window).
            // but the mousewheel event is still fired on the body element…
            this.iFrames[0].contentDocument.defaultView.addEvent('scroll', syncRightScrollAnchor);
        else
            contentWrappers[0].addEvent('scroll', syncRightScrollAnchor);

        // Same as above, but for the second content wrapper
        // Respond to touch events on mobile browsers.
        var scrollElement2 = contentWrappers[1];
        var eventElement2 = this.containsIFrames && iOS && supportTouchEvents ? this.iFrames[1].contentDocument.defaultView : scrollElement2;
        this.secondPartMouseWheelObserver = new PWMouseWheelObserver(eventElement2, function(element, deltas){
            doMouseWheel(deltas, scrollElement2);
            syncLeftScrollAnchor();
        }, this);

        if(this.containsIFrames && !PWBrowserIsIOS())
            // In webkit, where we use iFrames, we need to listen to the scroll event of the default view (which is the window).
            // but the mousewheel event is still fired on the body element…
            this.iFrames[1].contentDocument.defaultView.addEvent('scroll', syncLeftScrollAnchor);
        else
            contentWrappers[1].addEvent('scroll', syncLeftScrollAnchor);
    };

    if(this.containsIFrames){
        var me = this;
        PWWaitUntilIFramesAreLoaded(this.iFrames, function(){
            setupSyncScrollPositions_.call(me);
        });
    }
    else
        setupSyncScrollPositions_.call(this);

},

    // Converts absolute size values of both parts to relative values.
convertAbsoluteToRelativeValues: function(){
    var axis             = this.axis();
    var firstPartValue  = this.firstPart.getSize()[axis];
    var secondPartValue = this.secondPart.getSize()[axis];
    var splitterValue   = this.splitView.getElement('.splitter').getSize()[axis];
    var netValue         = firstPartValue + secondPartValue;
    firstPartValue      = (firstPartValue/netValue)*100.0;
    secondPartValue     = 100.0-firstPartValue;
    var property        = this.changeableProperty();
    this.firstPart.setStyle(property, firstPartValue+'%');
    this.secondPart.setStyle(property, secondPartValue+'%');
},

    // Returns true if part is collapsed (looks like its size is zero).
isPartCollapsed: function(part){
    var axis     = this.axis();
    var property = this.changeableProperty();
    var value    = part.getSize()[axis];
    var isFirstPart = part == this.firstPart;
    var splitter = isFirstPart ? this.firstSplitter : this.secondSplitter;

    // Take splitter size into account if the splitter in this part is visible.
    if(splitter.getStyle('display')=='block') {
        var size = splitter.getSize()[axis];
        if(value <= size)
            value = 0.0;
    }
    return value <= 0.0;
},

    // Returns the side of the content wrapper the splitter is attached to.
splitterSide: function(splitter) {
    var isFirstSplitter = this.firstSplitter == splitter;
    if(isFirstSplitter)
        return this.isVertical ? 'right' : 'bottom';
    return this.isVertical ? 'left' : 'top';
},

    // Shows or hides a splitter.
showSplitter: function (splitter, show) {
    var axis            = this.axis();
    var displayValue    = show ? 'block' : 'none';
    splitter.setStyle('display', displayValue);
    if(show)
        splitter.removeClass('moving');
    else
        splitter.removeClass('bold');
    var contentWrapper  = splitter.getParent().getElement('.contentWrapper');
    var distance        = show ? splitter.getSize()[axis] : 0;
    contentWrapper.setStyle(this.splitterSide(splitter), distance);
},

    // This method makes exactly one splitter visible at a time and sets this.visibleSplitter to it.
makeOneSplitterVisible: function() {
    if(this.isPartCollapsed(this.firstPart)) {
        // If the first part is collapse show the second splitter
        this.showSplitter(this.firstSplitter, false);
        this.showSplitter(this.secondSplitter, true);
        this.visibleSplitter = this.secondSplitter;
        this.firstPart.setStyle(this.changeableProperty(), 0);
    }else if(this.isPartCollapsed(this.secondPart)){
        // If the first part is collapse show the first splitter
        this.showSplitter(this.firstSplitter, true);
        this.showSplitter(this.secondSplitter, false);
        this.visibleSplitter = this.firstSplitter;
        this.secondPart.setStyle(this.changeableProperty(), 0);
    } else {
        // Otherwise show the first splitter
        this.showSplitter(this.firstSplitter, true);
        this.showSplitter(this.secondSplitter, false);
        this.visibleSplitter = this.firstSplitter;
    }
},

    // Changes the thickness of the splitter inside element.
    // The size is changed by assigning or removing the 'bold' style.
    // If makeThick is true 'bold' is assigned. Otherwise 'bold' is removed.
changeSplitterThicknessInsideElement: function(element, makeThick){
    var axis            = this.axis();
    var property       = this.changeableProperty();
    var splitter       = element.getElement('.splitter');
    var splitterSide   = this.splitterSide(splitter);
    var contentWrapper = element.getElement('.contentWrapper');
    if(makeThick) {
        splitter.addClass('bold');
        //            console.log('make bold / has bold: '+splitter.hasClass('bold'));
    } else
        splitter.removeClass('bold');
    contentWrapper.setStyle(splitterSide, splitter.getSize()[axis]);
},

adjustSplitterThickness: function(){
    // Make second splitter bigger if needed:
    this.changeSplitterThicknessInsideElement(this.secondPart, this.isPartCollapsed(this.firstPart));

    // Make first splitter bigger if needed:
    this.changeSplitterThicknessInsideElement(this.firstPart, this.isPartCollapsed(this.secondPart));
},

    });

