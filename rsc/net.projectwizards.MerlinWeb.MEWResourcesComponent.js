MEWResourcesController = new Class({
    
    Extends: WBLSplitViewController,
        
        // componentElement is a splitview which separates the group view on the left side from the resources view on the right side
    initialize: function(componentElement, options){
        
        // Add us to the autorelease pool
        PWAutoreleasePool.addObjectToPoolForElement(this, componentElement);
        
        this.componentElement        = componentElement;
        this.groupsOutlineHeader     = componentElement.getElement('.part:first-of-type .header');
        this.resourcesOutlineHeader  = componentElement.getElement('.part:last-of-type  .header');
        
        // On zoom change, sync the row and header heights:
        var controller = this;
        var gantt = this.gantt;
        this.zoomDetector = new PWZoomDetector(function () {
            controller.updateGroupsHeaderHeight();
        });
        
        this.updateGroupsHeaderHeight.delay(100, this);
        this.parent(componentElement, options);
    },
        
    dispose: function() {
        this.parent();
        //console.log('dispose MEWResourcesComponent');
    },

        // Overwritten from WBLSplitViewController. If iFrames are used this is called after their content is loaded.
    setupAfterScrollviewsAreReady: function(){
        this.parent();
        
        // Manually notify both scrollviews.
        this.firstScrollView.setupAfterContentDocumentIsReady();
        this.secondScrollView.setupAfterContentDocumentIsReady();
        this.secondScrollView.resourcesComponent = this;
    },
        
        // Make the height of the groups header the same as the height of the resources header:
    updateGroupsHeaderHeight: function() {
        
        this.groupsOutlineHeader.setStyle('height', this.resourcesOutlineHeader.offsetHeight);
        this.firstScrollView.updateLayout();
    },
        
    syncHeaderHeights: function() {
        this.groupsOutlineHeader.setStyle('height', (''+this.resourcesOutlineHeader.offsetHeight + 'px'));
    }

});

MEWResourcesOutlineComponent = new Class({
    
    Extends: WBLOutlineController,
    initialize: function(outlineElement, adjustColumnWidths){
        this.parent(outlineElement, adjustColumnWidths);
    },

    onContentDocumentIsReady: function(callback, context){
        // Intentionally left blank. onReady is called by the MEWResourcesController.
    },
        
    onColumnResize: function(el, headerColumn, contentColumn, index){
        this.parent(el, headerColumn, contentColumn, index);
        this.resourcesComponent.syncHeaderHeights();
    },
    
    doubleClick: function(row, event){
    }

        
});
