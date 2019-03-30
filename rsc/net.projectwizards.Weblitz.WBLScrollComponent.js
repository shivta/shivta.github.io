// WBLScrollComponentController implements the behavior of a scroll view with a vertical or/and a horizontal ruler.
// Both rulers are optional. The scroll positions between ruler and main content can be synced (also optional).
//
// Scroll view markup example:
//
//    <div class="scrollview">
//        <div class="vertical ruler">
//            <div class="corner"></div>
//            <div class="content">
//                ...
//            </div>
//        </div>
//
//        <div class="horizontal ruler">
//                ...
//        </div>
//        <div class="main content">
//                ...
//        </div>
//    </div>

WBLScrollComponentController = new Class({

Implements: [Options],

options: {
    // If true the horizontal scroll position of the content is applied to the horizontal ruler as well.
    syncHorizontalRulerScrollPosition: true,

    // If true the vertical scroll position of the content is applied to the vertical ruler as well.
    syncVerticalRulerScrollPosition: true,

    verticalRulerIsResizable: false,

    minVerticalRulerSize: 50,

    maxVerticalRulerSize: 400,

    // A string which is put in front of the regular content inside the iFrame. Base64 encoded.
    preIFrameContent: null,

    // A string which is put after the regular content inside the iFrame. Base64 encoded.
    postIFrameContent: null,

    // If true, javascript and css is loaded with XMLHTTPRequests to prevent flicker.
    optimizedScriptAndCSSLoadingInIFrames: true,

    // If set to truw the vertical scroll position is based on row indices.
    // For this to work, the content must contain objects with a 'row' css class and
    // each row element must have a custom attribute 'data-idx' which must hold the index of the row.
    rowIndexBasedScrolling: false,

    // If given, the selection will be pushed to the server immediately not only via the form field.
    scrollStateDidChangeAction: null
},

initialize: function(scrollView, options){

    this.setOptions(options);

//    console.log(PWObjectId(this)+' Initialize WBLScrollComponentController');
//    console.dir(this.options);

    // Add us to the autorelease pool
    PWAutoreleasePool.addObjectToPoolForElement(this, scrollView);

    this.initInvariants(scrollView);

    this.onContentDocumentIsReady(function(){
        this.setupAfterContentDocumentIsReady();
        this.restoreSavedScrollPosition();
    }, this);
},


initInvariants: function(scrollView){

    window.pwScrollStates = window.pwScrollStates ? window.pwScrollStates : {};

    this.identifier = scrollView.getProperty('id');
    this.stateFormField = $(scrollView.getProperty('id')+"-StateField");

    this.scrollView = scrollView;
    this.scrollView.scrollViewController = this;
    this.scrollBarsWidth = WBLScrollComponentController.scrollbarWidth();

    this.useIFramesIfNeeded();
    this.iFrames         = scrollView.getElements('iframe');
    this.containsIFrame = this.iFrames.length > 0;
    WBLScrollComponentController.registerScrollComponent(this);
},

    // Waits for iFrames if they are used. Can be overwritten in subclasses in order to wait for other things.
onContentDocumentIsReady: function(callback, context){
    if(this.containsIFrame){
        PWWaitUntilIFramesAreLoaded(this.iFrames, function(){
            callback.call(context);
        });
    }
    else
        callback.call(context);
},

    // Can be overwritten in subclasses. If iFrames are used this is called after their content is loaded.
setupAfterContentDocumentIsReady: function() {
    var scrollView = this.scrollView;

    var container               = this.containsIFrame ? this.iFrames[0].contentDocument.body : scrollView;
    this.horizontalRuler        = scrollView.getElement('.horizontal.ruler');
    this.horizontalRulerContent = this.horizontalRuler.getChildren()[0];

    var verticalRuler = scrollView.getElement('.vertical.ruler');
    if(verticalRuler){
        this.verticalRuler = verticalRuler;
        this.verticalRulerContent = verticalRuler.getElement('.content');
        this.verticalRulerCorner  = verticalRuler.getElement('.corner');

        // Make the vertical ruler resizable if needed
        if(this.options.verticalRulerIsResizable)
            this.makeVerticalRulerResizable();
    }

    this.updateHasHorizontalScroller();
    this.updateHasVerticalScroller();

    var me = this;
    window.addEvent('resize', function(event) {
        me.updateLayout();
    });

    this.updateLayout();
    this.setupSyncScrollPositionWithRulers();
},

makeVerticalRulerResizable: function(){
    var verticalRuler = this.verticalRuler;

    // This is the splitter handle inside the vertical ruler:
    var splitterHandle = new Element('div', {'class':'splitterHandle'});
    splitterHandle.inject(verticalRuler);

    var me = this;
    var dragShield = new PWDragShield('col-resize');
    var options = {
        limit:{x:[this.options.minVerticalRulerSize, this.options.maxVerticalRulerSize]},
        snap:0,
        modifiers: {y:''},
        handle:splitterHandle,
        onBeforeStart: function(el){
            dragShield.show();
        },
        onDrag: function(el){
            me.syncVerticalRulerSplitterHandlePosition(verticalRuler);
        },
        onCancel: function(){
            dragShield.hide();
        },
        onComplete: function(el){
            dragShield.hide();
            verticalRuler.getStyle('width')
            me.syncVerticalRulerSplitterHandlePosition(verticalRuler);
        }
    };
    //this.verticalRuler.makeResizable(options);

    // This is the splitter handle to the right of the vertical ruler:
    this.verticalRulerSplitterHandle = new Element('div', {'class':'verticalRulerSplitterHandle'});
    this.verticalRulerSplitterHandle.inject(this.scrollView);
    options.handle = this.verticalRulerSplitterHandle;
    this.verticalRuler.makeResizable(options);

    this.syncVerticalRulerSplitterHandlePosition(verticalRuler);
},

syncVerticalRulerSplitterHandlePosition: function(verticalRuler){
    this.verticalRulerSplitterHandle.setStyle('left', verticalRuler.getStyle('width'));
},

dispose: function() {
    WBLScrollComponentController.deregisterScrollComponent(this);

//    console.log('dispose WBLScrollComponentController');
    window.removeEvents('resize');

    // Dispose scroll and mouse events established in setupSyncScrollPositionWithRulers
    this.disposeScrollAndMouseWheelEvents();
    this.cancelPersistScrollStateTimer();
},

usesIFrames: function(){
//    return false; // TODO: Remove after debugging

    // Firefox does not need iFrames in order to speed up scrolling.
    // Chrome gets better and better so we do not force iFrames.
    return !PWBrowserIsFirefox(); //&& !Browser.chrome;
},

useIFramesIfNeeded: function() {

    // The main content is the element which is replaced by an iFrame in webkit browsers.
    this.mainContent = this.scrollView.getElement('.main.content');

    // Use iframes in all brosers but not in Firefox, because the scrolling speed in firefox is fast enough.
    // Note: If we want to use iFrames in Firefox too, we need to adjust the scrolling code. It does not work out of the box.

    if(this.usesIFrames()) {

        this.willReplaceContentWithIFrames();

        var containerClass = this.mainContent.get('class');
        var iFrameClass = containerClass + ' contentIFrame';

        // Load the script which is needed inside the iFrame in order to import scripts and css from the main window:
        // Note: It is very important to include the <!DOCTYPE html> tag, because otherwise strange style rules will be applied.

        var iFrameContent;
        if(this.options.optimizedScriptAndCSSLoadingInIFrames)
            iFrameContent = '<!doctype html><meta charset="utf-8"/>' + scriptForLoadingJavascriptAndCSSFromDocument(document);
        else
            iFrameContent = "<!DOCTYPE html><script src=\""+URLOfIFrameBootJS()+"\"></script><script>includeJavascriptFilesUsedInParentWindow(); includeCSSUsedInParentWindow();</script>";

        if(this.options.preIFrameContent)
            iFrameContent += this.options.preIFrameContent.decodeBase64();

        iFrameContent += this.mainContent.innerHTML;

        if(this.options.postIFrameContent)
            iFrameContent += this.options.postIFrameContent.decodeBase64();

        // This script is appended in order to notify that the iFrame content is fully loaded:
        iFrameContent += '<script>postIFrameDidLoadIfNeeded();</script>';

        // Test if using layers makes a difference (webkit-transform):
        //            var iFrame = new Element('iframe', {'class':iFrameClass, 'frameborder':'0', 'style':'-webkit-transform: rotateY(0deg) rotateX(0deg);'});

        var iFrameContainer = new Element('div', {'styles':{'position':'relative', 'overflow-x':'hidden', 'overflow-y':'hidden', 'height':'100%'}});
        var iFrame = new Element('iframe', {'class':iFrameClass, 'frameborder':'0', 'allowtransparency':'true'});

        WBLIFramePrepare(iFrame);


        var parent = this.mainContent.parentElement;


        // Unfortunately the iFrame.contentDocument is not available at this point.
        // So we can not inject it fully prepared into the page. But replacing the old content with parent.replaceChild and
        // without preparing the iFrame first, causes an unnecessary paint event (with white content) which is not desirable.
        // The additional paint event is omited if we use appendChild and removeChild instead.
        //
        // TODO: It looks like this solution does not always work as described

        // Add the iFrame on top of the content which should be replaced by it:


        parent.appendChild(iFrameContainer);
        iFrameContainer.appendChild(iFrame);

        // Set the content of the iFrame:
        var frameDocument = iFrame.contentDocument;
        frameDocument.open();
        frameDocument.write(iFrameContent);
        // This is important because otherwise state events would fire at unexpected times.
        frameDocument.close();


        // Remove the old content:
        parent.removeChild(this.mainContent);

        this.mainContent = iFrame;

        // Unfortunately scrolling in iFrames is somewhat broken in iOS. So we need to fix it.
        // https://forum.bubble.is/t/scrolling-within-an-iframe/2675/7
        if(this.useIOSFixForScrollingInIFrames){
            iFrame.parentElement.setStyle('overflow','auto');
            iFrame.parentElement.setStyle('-webkit-overflow-scrolling','touch');
        }
    }
},

useIOSFixForScrollingInIFrames: function(){
    return PWBrowserIsIOS();
},

// Can be overwritten in subclasses
willReplaceContentWithIFrames: function(){

},

debugName: function(){
    return 'ScrollComponent';
},

updateScrollStateInHiddenTextField: function() {
    if(!this.isRestoringScrollPosition){
        var formField = this.stateFormField;
        if(formField){
            var me = this;
            var stateFormField = this.stateFormField;
            var action = this.options.scrollStateDidChangeAction;
            function updateState(){
                var vPos = me.verticalScrollPosition();
                var hPos = me.horizontalScrollPosition();
                // TODO: The scaling/zoom factor is just looped through, because the scale is currently
                //       not changeable inside the browser without loading the page again.
                var oldState = me.valuesFromStateFormField();
                var scaling = oldState.scaling;
                stateFormField.value = "{'verticalPosition':"+vPos+",'horizontalPosition':"+hPos+",'scaling':"+scaling+"}";
//                console.log(me.debugName()+' / Save state: '+stateFormField.value);
                // If a scrollStateDidChangeAction is given, the scroll state is immediately send to the server.
                if(action)
                    action({verticalPosition:vPos, horizontalPosition:hPos, scaling:scaling});
            }
            // Defer the call to updateState until the user stops scrolling:
            this.cancelPersistScrollStateTimer();
            this.persistScrollStateTimer = updateState.delay(100);
        }
    }
},

// Can be overwritten in subclasses. By default returns the vertical scroll position in pixels:
// Make sure to overwrite also restoreScrollPosition if you use an own scroll position schema.
verticalScrollPosition: function() {
    if(this.options.rowIndexBasedScrolling){
        // Compute the scroll position by returning row fractions
        var scrollTop = this.scrollElement().pwScrollTop();
        var rows = this.rows();
        var count = rows.length;
        for(var i=0; i<count; i++){
            var row = rows[i];
            var top = row.offsetTop
            var height = row.offsetHeight;
            var bottom = top+height;
            if(top <= scrollTop && bottom >= scrollTop){
                return i+(scrollTop-top)/height;
            }
        }
        return 0;
    }else
        return this.scrollElement().pwScrollTop();
},

// Same comment as in verticalScrollPosition
horizontalScrollPosition: function() {
    return this.scrollElement().scrollLeft;
},

// Can be overwritten in subclasses
restoreScrollPosition: function(hPos, vPos, scaling) {
    if(this.options.rowIndexBasedScrolling)
        vPos = this.verticalScrollPositionFromRowIndex(vPos);
    var scrollElement = this.scrollElement();
    if(PWBrowserIsChrome() && PWElementIsBody(scrollElement))
        scrollElement.scrollTo(hPos, vPos);
    else{
        scrollElement.scrollTop = vPos;
        scrollElement.scrollLeft = hPos;
    }
},

// If scrollViewStateString is null, the values are taken from this.stateFormField.
// If scrollViewStateString is given, the value is first applied to the stateFormField
// and then the scroll positions are adjusted.
restoreSavedScrollPosition: function() {

    // TODO: This is just a test and not final. This flag should be evaluated inside setupSyncScrollPositionWithRulers
    this.isRestoringScrollPosition = true;
    (function(){
        this.isRestoringScrollPosition = false;
    }).delay(100, this);

    var values = this.valuesFromStateFormField();
    this.restoreScrollPosition(values.horizontalPosition, values.verticalPosition, values.scaling);
},

// Returns a dictionary with the following keys and values (floats): horizontalPosition, verticalPosition, scaling.
valuesFromStateFormField: function(){
    var values = eval('('+this.stateFormField.value+')');
    return {'horizontalPosition':values['horizontalPosition'].toFloat(),
            'verticalPosition':values['verticalPosition'].toFloat(),
            'scaling':values['scaling'].toFloat() };
},

// Called by the server to update the scroll state
setScrollState: function(scrollState) {
    if(scrollState)
    {
        this.stateFormField.value = scrollState;
        this.restoreSavedScrollPosition();
    }
},

// Note: rowIndex is a floating point number. The integer part is the row index.
// The fractional part is the height portion.
verticalScrollPositionFromRowIndex: function(rowIndex) {
    var index = rowIndex.toInt();
    var row = this.visibleRowAtIndex(index);
    if(row)
        return row.offsetTop + ((rowIndex-index)*row.offsetHeight);
    return 0;
},

cancelPersistScrollStateTimer: function() {
    if(this.persistScrollStateTimer)
        clearTimeout(this.persistScrollStateTimer);
},

scrollElement: function() {
    // Note: Works only with one iFrame
    if(!this.scrollElement_){
        var result = this.scrollView.getElement('.main.content');
        if(this.containsIFrame){
            result = this.scrollView.getElement('.contentIFrame');
            // Unfortunately scrolling in iFrames is somewhat broken in iOS. So we need to fix it.
            // https://forum.bubble.is/t/scrolling-within-an-iframe/2675/7
            if(this.useIOSFixForScrollingInIFrames())
                result = result.parentElement;
            else
                result = PWIEVersion()>0 ? result.contentDocument.body.parentElement : result.contentDocument.body;
        }
        this.scrollElement_ = result;
    }
    return this.scrollElement_;
},

verticalScrollerIsVisible: function() {
    if(this.containsIFrame){
        if(!this.mainContent.contentDocument || !this.mainContent.contentDocument.body)
            return false;
        return    this.scrollBarsWidth > 0
        && this.mainContent.clientHeight < this.mainContent.contentDocument.body.scrollHeight
        && this.mainContent.getStyle('overflow-y') != 'hidden';
    }
    else
        return        this.scrollBarsWidth > 0
        && this.mainContent.clientHeight < this.mainContent.scrollHeight
        && this.mainContent.getStyle('overflow-y') != 'hidden';
},

horizontalScrollerIsVisible: function() {
    if(this.containsIFrame){
        if(!this.mainContent.contentDocument || !this.mainContent.contentDocument.body)
            return false;
        return    this.scrollBarsWidth > 0
        && this.mainContent.clientWidth < this.mainContent.contentDocument.body.scrollWidth
        && this.mainContent.getStyle('overflow-x') != 'hidden';
    }
    else
        return        this.scrollBarsWidth > 0
        && this.mainContent.clientWidth < this.mainContent.scrollWidth
        && this.mainContent.getStyle('overflow-x') != 'hidden';
},

// The horizontal ruler never has a vertical scrollbar.
// But the main content perhaps has one. So both areas could have a different width.
// We add some padding to the right side of the ruler content instead of showing a scrollbar..
// This is needed because otherwise horizontal scroll positions could not be synced properly.
updateHasVerticalScroller: function() {
    var hasVerticalScroller = this.verticalScrollerIsVisible();
    if(this.hasVerticalScroller != hasVerticalScroller)
    {
        this.hasVerticalScroller = hasVerticalScroller;
        this.updateRulerPaddingRight();
    }
},

updateHasHorizontalScroller: function() {
    var hasHorizontalScroller = this.horizontalScrollerIsVisible();
    if(this.hasHorizontalScroller != hasHorizontalScroller)
    {
        this.hasHorizontalScroller = hasHorizontalScroller;
        this.updateRulerPaddingRight();
    }
},

updateRulerPaddingRight: function() {
    if(this.horizontalRulerContent){
        var padding = '0px';
        if(this.hasVerticalScroller && this.hasHorizontalScroller)
            padding = this.scrollBarsWidth+'px';
        this.horizontalRulerContent.setStyle('padding-right', padding);
    }
},


setupSyncScrollPositionWithRulers: function() {
    if(this.options.syncHorizontalRulerScrollPosition || this.options.syncVerticalRulerScrollPosition) {
        function setupSync(){

            // Sync the scroll position of the scrollElement with the rulers.
            var scrollElement = this.scrollElement();
            var scrollView = this;
            var syncContentScrollPositionWithRulers = function() {
                // Everytime the scroll position changes we save the state in a hidden text field:
                scrollView.updateScrollStateInHiddenTextField();
                var contentScroll = scrollElement.getScroll();
                if(scrollView.options.syncHorizontalRulerScrollPosition && scrollView.horizontalRuler) {
                    var horizontalRulerScroll = scrollView.horizontalRuler.getScroll();
                    if(horizontalRulerScroll.x != contentScroll.x)
                        scrollView.horizontalRuler.pwScrollToLeft(contentScroll.x);
                }
                if(scrollView.options.syncVerticalRulerScrollPosition && scrollView.verticalRulerContent) {
                    var verticalRulerScroll = scrollView.verticalRulerContent.getScroll();
                    if(verticalRulerScroll.y != contentScroll.y)
                        scrollView.verticalRulerContent.pwScrollToTop(contentScroll.y);
                }
            };

            // In case we use iFrames we do not get a scroll event on the iFrame's body, but on its defaultView
            // which is the window. But we still need to use scrollLeft/Top of the body. It is a little bit confusing but works.
            if(this.containsIFrame && !PWBrowserIsIOS())
                this.iFrames[0].contentDocument.defaultView.addEvent('scroll', syncContentScrollPositionWithRulers);
            else
                scrollElement.addEvent('scroll', syncContentScrollPositionWithRulers);

            // Sync the scroll positions of the rulers with the scrollElement.
            // We need to add mouse wheel events to the rulers because they have no scrollbars
            // and therefore fire no scroll events .
            var verticalRuler   = this.verticalRuler;
            var horizontalRuler = this.horizontalRuler;
            var doMouseWheelInRuler = function(ruler, deltas){
                if(ruler == verticalRuler) {
                    ruler.scrollBy( 0, -deltas.y);
                    scrollElement.pwScrollToTop(ruler.pwScrollTop());
                }else if (ruler == horizontalRuler) {
                    ruler.scrollBy(-deltas.x, 0);
                    scrollElement.pwScrollToLeft(ruler.pwScrollLeft());
                }
            };
            if(this.options.syncVerticalRulerScrollPosition && verticalRuler)
                this.verticalRulerMouseWheelObserver = new PWMouseWheelObserver(verticalRuler, doMouseWheelInRuler, this);
            if(this.options.syncHorizontalRulerScrollPosition && horizontalRuler)
                this.horizontalRulerMouseWheelObserver = new PWMouseWheelObserver(horizontalRuler, doMouseWheelInRuler, this);
        }
        var me = this;
        if(this.containsIFrame){
            PWWaitUntilIFramesAreLoaded(this.iFrames, function(){
                setupSync.call(me);
            });
        }
        else
            setupSync.call(me);
    }
},


disposeScrollAndMouseWheelEvents: function(){
    var mainContent = this.mainContent;
    if(this.containsIFrame && this.iFrames[0].contentDocument)
        this.iFrames[0].contentDocument.defaultView.removeEvents('scroll');
    else
        mainContent.removeEvent('scroll');

    if(this.horizontalRulerMouseWheelObserver){
        this.horizontalRulerMouseWheelObserver.dispose();
        this.horizontalRulerMouseWheelObserver = null;
    }
    if(this.verticalRulerMouseWheelObserver){
        this.verticalRulerMouseWheelObserver.dispose();
        this.verticalRulerMouseWheelObserver = null;
    }
},


    // updateLayout needs to be called from outside whenever the size of the surrounding element did change.
updateLayout: function () {
    this.updateHasVerticalScroller();
    this.updateHasHorizontalScroller();

    var contentHeight = this.scrollView.offsetHeight;

    // Adjust the height of the main content view:
    if(this.horizontalRuler){
        contentHeight -= this.horizontalRuler.offsetHeight;
        this.mainContent.setStyle('height', contentHeight+'px');
        if(PWBrowserIsIOS())
            this.scrollElement().setStyle('height', contentHeight+'px');
    }

    if( this.verticalRuler && this.verticalRulerCorner && this.horizontalRuler){
        // Adjust the height of the corner view to match the height of the horizontal ruler view:
        this.verticalRulerCorner.setStyle('height', this.horizontalRuler.offsetHeight+'px');

        // Set the height of the vertical ruler content to the content height:
        this.verticalRulerContent.setStyle('height', contentHeight-WBLScrollComponentController.scrollbarWidth()+'px');
    }
},

rows: function(){
    return this.scrollElement().getElements('.row');
},

rowAtIndex: function(index){
    var rows = this.scrollElement().getElements('.row[data-idx="'+index+'"]');
    return rows.length > 0 ? rows[0] : null;
},

visibleRowAtIndex: function(index){
    var rows = this.rows();
    var count = rows.length;
    var visibleRowIndex = 0;
    for(var i=0; i<count; i++){
        var row = rows[i];
        if(row.getStyle('display') != 'none'){
            if(index == visibleRowIndex){
                return row;
            }
        }else
            continue;
        visibleRowIndex++;
    }
    return null;
}

});

WBLScrollComponentController.scrollbarWidth = function() {
    if(WBLScrollComponentController._scrollBarWidth===undefined) {

        // Create the measurement node
        var scrollDiv = new Element("div", {'styles':{'width':'100px', 'height':'100px', 'overflow':'scroll', 'position':'absolute', 'top':'-999px'}});
        document.body.appendChild(scrollDiv);

        // Get the scrollbar width
        WBLScrollComponentController._scrollBarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;

        // Delete the DIV
        document.body.removeChild(scrollDiv);
    }
    return WBLScrollComponentController._scrollBarWidth;
};

WBLScrollComponentController.registerScrollComponent = function(scrollComponent) {
    WBLScrollComponentController.instances = WBLScrollComponentController.instances || new Hash();
    WBLScrollComponentController.instances.set(scrollComponent.identifier, scrollComponent);
};

WBLScrollComponentController.deregisterScrollComponent = function(scrollComponent) {
    WBLScrollComponentController.instances.erase(scrollComponent.identifier);
};

WBLScrollComponentController.scrollComponentInstanceWithIdentifier = function(identifier) {
    if(identifier && WBLScrollComponentController.instances)
        return WBLScrollComponentController.instances.get(identifier);
    return null;
};

WBLScrollComponentController.updateScrollStateInScrollComponentWithIdentifier = function(scrollState, identifier) {
    var scrollComponent = WBLScrollComponentController.scrollComponentInstanceWithIdentifier(identifier);
    if(scrollComponent)
        scrollComponent.setScrollState(scrollState);
}
