MEWGanttController = new Class({
    
	Extends: WBLSplitViewController,
    
	    // componentElement is a splitview which separates the outline view on the left side from the gantt view on the right side
	initialize: function (componentElement, options) {
    
	//    console.log(PWObjectId(this)+' Initialize MEWGanttController iFrame='+window.frameElement);
    
	    this.componentElement = componentElement;
	    this.parent(componentElement, options);
	},

	usesZoomDetector: false, // TODO: set to true for release
    
	    // Overwritten from WBLSplitViewController. If iFrames are used this is called after their content is loaded.
	setupAfterScrollviewsAreReady: function(){
	    this.parent();
    
	    // Manually notify both scrollviews.
	    this.firstScrollView.setupAfterContentDocumentIsReady();
	    this.secondScrollView.setupAfterContentDocumentIsReady();
    
	    //console.log(PWObjectId(this)+' MEWGanttController onReady');
    
	    var componentElement  = this.componentElement;

	    this.outlineHeader    = componentElement.getElement('.part:first-of-type .header');
	    this.timeScale        = componentElement.getElement('.part:last-of-type .timeScale');
	    this.outlineDocument  = document;
	    this.ganttDocument    = document;
	    this.rowHeightsTextField = $(componentElement.getProperty('ID')+'-GR');

        // Activate a rule which centers timephase boxes vertically in browsers which do not use webkit.
        // Search for "body.noneWebkit .gantt .timePhase .box".
        if(!PWIsWebkit()){
            var body = componentElement.getParent('body');
            body.addClass('noneWebkit');
        }
    
	    var outlineTable = componentElement.getElement('.part:first-of-type .outlineTable');
	    // If we can not find a outline table, we perhaps use iFrames. So we have to search inside the iFrame:
	    if(!outlineTable) {
	        var iFrame = componentElement.getElement('.part:first-of-type iframe');
	        outlineTable = iFrame.contentDocument.getElement('.outlineTable');
	        this.outlineDocument = iFrame.contentDocument;
	    }
		this.outlineTable = outlineTable;
		
	    var ganttTable = componentElement.getElement('.part:last-of-type .gantt > .rows');
	    // If we can not find a gantt table, we perhaps use iFrames. So we have to search inside the iFrame:
	    if(!ganttTable){
	        var iFrame = componentElement.getElement('.part:last-of-type iframe');
	        ganttTable = iFrame.contentDocument.getElement('.gantt > .rows');
	        this.ganttDocument = iFrame.contentDocument;
	    }
		this.timephaseLabelsHeader = componentElement.getElement('.corner.header');
        
		this.ganttTable = ganttTable;
    
	    // Let the scrollviews know about this controller
	    this.firstScrollView.setGanttController(this);
	    this.secondScrollView.ganttController = this;
    
		// Especially in Safari we need to wait for images because this affects the layout and can cause problems when row heights are synced
		var me = this;
		PWWaitForImagesInDocument(this.outlineDocument, function(){
			me.setupAfterOutlineIsReady();
		});

	    this.firstScrollView.restoreSavedScrollPosition();
	    this.secondScrollView.restoreSavedScrollPosition();
	},
    
	makeGanttRowsSelectable: function(){
	    // see: MEWOutlineComponent.js
	    var outlineComponent = this.componentElement.getElements('.outlineview')[0].scrollViewController;
	    var ganttRows = outlineComponent.flatGanttRows;
                
	    ganttRows.each(function(ganttRow){
            var selectionEventHandler = function(event){
	            var outlineRow = outlineComponent.outlineRowforGanttRow(ganttRow);
	            outlineComponent.selectionEventInRow(outlineRow, event);
	            event.stop();
            };
	        ganttRow.addEvent('mousedown', selectionEventHandler);
            
            var labelViewRow = ganttRow.labelViewRow;
            if(labelViewRow){
                labelViewRow.addEvent('mousedown', selectionEventHandler);
            }
	    });
	},
    
	setupAfterOutlineIsReady: function(){
	    var ID = this.componentElement.getProperty('ID');
	    this.headerHeightTextField = document.getElementById(ID+'-HH');
        
	    this.syncRowHeights();
    
	    var componentElement = this.componentElement;
	    var ganttElement = componentElement.getElement('.part:last-of-type .gantt');
	    // If we can not find a gantt element, we perhaps use iFrames. So we have to search inside the iFrame:
	    if(!ganttElement){
	        ganttElement = componentElement.getElement('.part:last-of-type iframe').contentDocument.getElement('.gantt');
	    }
    
	    this.gantt = new MEWGanttLinesController(ganttElement, this.timeScale, this.ganttDocument, ID);
    
	    // On zoom change, sync the row and header heights:
	    var controller = this;
	    var gantt = this.gantt;

	    if(this.usesZoomDetector){
	        this.zoomDetector = new PWZoomDetector(function () {
	            controller.syncRowHeights();
	        });
	    }

	    // Make horizontal scrollbars always visible in the outline and the gantt:
	    // This is needed because otherwise vertical scroll positions could not be synced properly.
	    componentElement.getElements('.main.content').each(function(content){
	        content.setStyle('overflow-x','scroll');
	    });
    
	    this.makeGanttRowsSelectable();
    
	    // React on clicks inside the gantt (make it the first responder)
	    this.updateClickObserver();

	},
    
	updateClickObserver: function(){
	    var me = this;
	    this.gantt.ganttElement.addEvent('click', function(event){
	      		me.clickedInsideGantt(event);
	    });
	},
    
	clickedInsideGantt: function(event){
	    //console.log('clicked inside gantt'); // TODO: Set first responder
	},
    
	dispose: function() {
	    this.parent();
	    //console.log('dispose MEWGanttComponent');
	    if(this.usesZoomDetector)
	        this.zoomDetector.dispose();
	},
    
	    // TODO: Create a method for all measuring needs taking into account the computed style.
	preferredTimeScaleHeight: function()
	    {
	        // Get the measuring rows to obtain the native height of the timeScale
	        var rows = this.timeScale.getElements('.measuring .tier');
	        var numberOfRows = rows.length;
	        var result = 0;
	        Array.each(rows, function(row){
	            result += row.offsetHeight;
	        });
        
	        return result;
	    },
    
	updateScrollViewLayout: function()
	    {
	        var scrollviews = this.componentElement.getElements('.scrollview');
	        Array.each(scrollviews, function(scrollview){
	            scrollview.scrollViewController.updateLayout();
	        });
	    },
    
	syncHeaderHeights: function(){
//		var watch = new PWStopWatch(true);
	
	    var rows = this.componentElement.getElements(".timeScale > .tier");
	    var numberOfRows = rows.length;
        
	    // Clear all heights set in a previous sync call:
	    Array.each(rows, function(row){
	        row.setStyle('height', null);
	        row.setStyle('line-height', null);
	    });
	    this.outlineHeader.setStyle('height', null);
	    this.timeScale.setStyle('height', null);

//        watch.logIntervalDuration('A');

	    // Synchronize header heights (timescale and outline column headers):
        // Note: This call is a little bit slow in Firefox:
	    var outlineHeaderHeight = this.outlineHeader.offsetHeight;
        
//        watch.logIntervalDuration('B');
	    
        var timeScaleHeight     = this.preferredTimeScaleHeight();
	    var maxHeight           = Math.max(outlineHeaderHeight, timeScaleHeight);
                
	    // Setting the row height does not include the borders.
	    // Because each row has a top and a bottom border, we need to remove them from the calculation.
	    var borderSpace  = numberOfRows;
    
	    // Calculate row height and round it. Otherwise it would not look good in Webkit which needs whole-number heights.
	    var rowHeight   = Math.round(((maxHeight-borderSpace) / numberOfRows));
	    var rowHeightPx = rowHeight+'px';

	    Array.each(rows, function(row){
	        row.setStyle('height', rowHeightPx);
	        row.setStyle('line-height', rowHeightPx);
	    });
    
	    // Calculate the final maximum height by using the rounded row heights:
	    maxHeight   = ((rowHeight*rows.length)+borderSpace);
	    maxHeightPx = maxHeight +'px';
    
	    this.outlineHeader.setStyle('height', maxHeightPx);
	    this.timeScale.setStyle('height', maxHeightPx);
	    this.timeScale.getParent().getParent().setStyle('height', maxHeightPx);

	    // Update the scrollview layout in the outline view and the gantt view:
	    this.updateScrollViewLayout();
	    this.headerHeightTextField.setProperty('value', maxHeightPx+','+rowHeightPx);
        
//        if(this.timephaseLabelsHeader)
//            this.timephaseLabelsHeader.setStyle('height', maxHeightPx);
        
//		watch.logDuration('syncHeaderHeights');
	},
        
	syncRowHeights: function() {
	    this.syncHeaderHeights();
	    this.syncContentRowsHeights();
	},

	syncContentRowsHeights: function(affectedOutlineRows) {
		if(!affectedOutlineRows)
			affectedOutlineRows = this.visibleOutlineRows();
		var affectedGanttRows = this.correspondingGanttRowsForOutlineRows(affectedOutlineRows);
		this.syncRowHeightsBetweenCorrespondingRows(affectedOutlineRows, affectedGanttRows);
	    this.saveRowHeightsInInputField();	
	},
    
	saveRowHeightsInInputField: function() {
	    var heights = '';
	    this.outlineTable.getElements('.otherTableRowDiv').each(function(div){
	        heights+=div.rowHeight+',';
	    });
	    if(heights.length)
	        heights = heights.substring(0, heights.length-1);
	    this.rowHeightsTextField.setProperty('value', heights);
	},

	// syncRowHeightsBetweenCorrespondingRows can sync the table row heights between two tables.
	// Both tables must have the same row count and each row must have an additional cell (td/th)
	// which contains a div with the class "otherTableRowDiv".
	// Please see syncRowHeightsWithOtherTable for a description how the sync works.
	//
	// Table markup example:
	//
	//  <table>
	//      <colgroup>
	//         <col width="60px" span="2"/>
	//      </colgroup>
	//      <thead>
	//          <tr>
	//              <th><div">Column 1</div></th>
	//              <th><div">Column 2</div></th>
	//              <th class="hidden"><div class="otherTableRowDiv"></div></th>
	//          </tr>
	//      </thead>
	//      <tbody>
	//          <tr>
	//              <td><div>Text 1</div></td>
	//              <td><div>Text 2</div></td>
	//              <td class="hidden"><div class="otherTableRowDiv"></td>
	//          </tr>
	//      </tbody>
	//  </table>
    	
    // Note: rowsB must be gantt rows
	syncRowHeightsBetweenCorrespondingRows: function(rowsA, rowsB){
//		var watch = new PWStopWatch(true);
	
		// Gets the maximum height of the content inside all td or th elements inside a tr element.
		var maxContentHeightInRow = function(row) {
//			if(row.pwHeight == undefined){
				row.boundingClientRect = row.getBoundingClientRect();
				row.pwHeight = row.boundingClientRect.height;
//			}
		    return row.pwHeight;
		};
    
	    var divs  = [];
	    var divs2 = [];
	    // clear heights from previous sync calls:
	    rowsA.each(function(trA, index){
	        var trB = rowsB[index];
	        if(!trB)
	             console.log("Error: Missing tr in rowsB at index: ", index);
			if(!trA.otherTableRowDiv)
				trA.otherTableRowDiv = trA.getElement('.otherTableRowDiv');
			if(!trB.otherTableRowDiv)
			trB.otherTableRowDiv = trB.getElement('.otherTableRowDiv');
			trA.otherTableRowDiv.setStyle('height', null);
			trB.otherTableRowDiv.setStyle('height', null);
	    });
    
	    // First measure the height:
	    rowsA.each(function(trA, index){
	        var trB = rowsB[index];
	        var h1 = maxContentHeightInRow(trA);
	        var h2 = maxContentHeightInRow(trB);
	        var maxHeight = Math.max(h1, h2) + 'px';        
	        var otherTableRowDiv  = trA.otherTableRowDiv;
	        otherTableRowDiv.rowHeight = maxHeight;
	        divs.push(otherTableRowDiv);
	        divs2.push(trB.otherTableRowDiv);
	    });
	
	    // Then apply the measured heights to all rows in one step:
	    // This is much faster than doing everything in one loop.
	    divs.each(function(div, index){
			var height = div.rowHeight;
	        var div2 = divs2[index];
	        div.setStyle('height' , ''+height);
	        div2.setStyle('height', ''+height);
            
            // Apply heights to label view rows if needed
            var ganttRow = rowsB[index];
            var labelViewRow = ganttRow.labelViewRow;
            if(labelViewRow)
                labelViewRow.setStyle('height', height);
	    });

//		watch.logDuration('syncRowHeightsBetweenCorrespondingRows row count: '+rowsA.length);
	},

	flushCachedHeightInRows: function(rows){
		rows.each(function(row){
			row.pwHeight = undefined;
		});
	},

	flushCachedHeightInOutlineRows: function(){
		this.flushCachedHeightInRows(this.visibleOutlineRows());
	},

	flushCachedHeightInGanttRows: function(){
		this.flushCachedHeightInRows(this.visibleGanttRows());
	},

	visibleOutlineRows: function(){
		return this.rowsInTable(this.outlineTable);
	},
	
	visibleGanttRows: function(){
		return this.rowsInTable(this.ganttTable);
	},
	
	correspondingGanttRowsForOutlineRows: function(outlineRows){
		return outlineRows.map(function(outlineRow){
			return outlineRow.ganttRow;
		});
	},
	
	rowsInTable: function (table) {
	    var result = [];
	    var body = table.getElements('tbody')[0];
	    var bodyRows = body ? body.getChildren() : null;
	    if(bodyRows)
	        result.append(bodyRows);
	    return result;
	},
	
    // SplitView delegate methods:
	splitViewWillMoveSplitter: function(splitviewController){
	    //        console.log('splitViewWillMoveSplitter');
	},
    
	splitViewIsMovingSplitter: function(splitviewController){
	    //        console.log('splitViewIsMovingSplitter');
	},
    
	splitViewDidMoveSplitter: function(splitviewController){
	    //        console.log('splitViewDidMoveSplitter');
	}
}); 
