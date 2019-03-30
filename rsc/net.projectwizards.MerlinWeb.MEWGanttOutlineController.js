MEWGanttOutlineController = new Class({
    
	Extends: WBLOutlineController,
    
    options: {
        rowIndexBasedScrolling: true
	},

    // Overwritten from WBLScrollComponentController in order to wait until the measurement element is ready too.
    onContentDocumentIsReady: function(callback, context){
        // Intentionally left blank. onReady is called by the gantt controller which holds the outline and the gantt together.
    },

	onColumnResize: function(el, headerColumn, contentColumn, index){
	    this.parent(el, headerColumn, contentColumn, index);
	    var ganttController = this.ganttController();
	    if(ganttController)
	        ganttController.syncHeaderHeights();
	},
    
	onColumnResizeComplete: function(el, headerColumn, contentColumn, index){
	    this.parent(el, headerColumn, contentColumn, index);
	    var ganttController = this.ganttController();
	    if(ganttController){
	        ganttController.syncRowHeights();
	        ganttController.gantt.updateLines();
	    }
	},
    
    doubleClick: function(row, event){
    },
    
	setGanttController: function(controller){
    
	    this._ganttController = controller;
    
	    // The following methods need a ganttController:

        this.prepareAlternateGanttRows();
        this.linkOutlineRowsWithGanttRows();
	    this.createFlatGanttRows();
                
	    this.updateGanttRowsVisibility(this.flatRows);
    
	    this.prepareGanttRowsWithServerSideSelection();
	    this.updateSelectionBordersInOutlineAndGantt();
	
		// DEBUG
//		this.prepareTest();
	},

	prepareTest: function(){

		var me = this;

		var measureRows = function(rows){
			// In MerlinWeb the height of the div element which represents the height of the related (gantt-) row,
			// is set to null in order to measure the intrinsic outline row height. This is done in three steps in order to prevent multiple layouts.
			// 1. the height is set to null in all rows.
			// 2. the intrinsic row height is measured for all rows.
			// 3. the new max height is set in all rows. 

			var modifyStyle = true;

			// Step 1
			rows.each(function(row){
				var heightDiv = row.getElement('.otherTableRowDiv');
				row.testHeightDiv = heightDiv;
				if(modifyStyle)
					heightDiv.setStyle('height', null);
			});

			// Step 2
			rows.each(function(row){
				row.height = row.getBoundingClientRect().height;			
			});
	
			// Step 3
			if(modifyStyle) {
				rows.each(function(row){
					row.testHeightDiv.setStyle('height', row.height+'px');
				});
			}
		}

		var getTestButtonContainer = function(){
			var mainDocument = parent.document;
			var mainBody = mainDocument.body;		
			var container = mainDocument.getElementById('TestButtonContainer');
			if(!container) {
				container = new Element('div', {
								id:'TestButtonContainer',
								styles: {
									display: 'block',
									position:'fixed',
									padding:'10px',								
									top:'0px',
									left:'800px',
									'background-color':'rgba(0,0,0,0.7)',
								}
							});
				container.inject(mainBody);
			}
			return container;
		}

		var createTestButton = function(title, action){
			var button = new Element('button', {
								html: title,
								events: {
							        click: action
							    },
								styles: {
									display: 'block',
									width:'100%'
								}

			});
			button.inject(getTestButtonContainer());		
		}

		// Tests:
	
		var measureOutlineRows = function(){
			var rows = me.rows();
			var watch = new PWStopWatch(true);
			measureRows(rows);
			alert('Time to measure height of '+rows.length+' outline rows: '+watch.duration());
		}

		var measureGanttRows = function(){
			var rows = me.rows().map(function(outlineRow){
				return outlineRow.ganttRow;
			});
			var watch = new PWStopWatch(true);
			measureRows(rows);
			alert('Time to measure height of '+rows.length+' gantt rows: '+watch.duration());
		}

		var measureOutlineAndGanttRows = function(event){
			var outlineRows = me.rows();
			var ganttRows = outlineRows.map(function(outlineRow){
				return outlineRow.ganttRow;
			});
			var watch = new PWStopWatch(true);
			measureRows(outlineRows);
			measureRows(ganttRows);
			alert(event.target.innerHTML+': '+watch.duration());
		}	

		var measureOutlineAndGanttRowsInterleaved = function(event){
			var table1Rows = me.rows();
			var table2Rows = table1Rows.map(function(outlineRow){
				return outlineRow.ganttRow;
			});
		
			var maxContentHeightInRow = function(row) {
	//			if(row.pwHeight == undefined)
					row.pwHeight = row.getBoundingClientRect().height;		
			    return row.pwHeight;
			};
		
			var watch = new PWStopWatch(true);
		
		    var divs  = [];
		    var divs2 = [];
		    // clear heights from previous sync calls:
		    table1Rows.each(function(tr, index){
		        var tr2 = table2Rows[index];
		        if(!tr2)
		             console.log("Error: Missing tr at index: ", index);
				if(!tr.otherTableRowDiv)
					tr.otherTableRowDiv = tr.getElement('.otherTableRowDiv');
				if(!tr2.otherTableRowDiv)
				tr2.otherTableRowDiv = tr2.getElement('.otherTableRowDiv');
				tr.otherTableRowDiv.setStyle('height', null);
				tr2.otherTableRowDiv.setStyle('height', null);
		    });
    
		    // First measure the height:
		    table1Rows.each(function(tr, index){
		        var tr2 = table2Rows[index];
		        var h1 = maxContentHeightInRow(tr);
		        var h2 = maxContentHeightInRow(tr2);
		        var maxHeight = Math.max(h1, h2) + 'px';
		        var otherTableRowDiv  = tr.otherTableRowDiv;
		        otherTableRowDiv.rowHeight = maxHeight;
		        divs.push(otherTableRowDiv);
		        divs2.push(tr2.otherTableRowDiv);
		    });
	
		    // Then apply the measured heights to all rows in one step:
		    // This is much faster than doing everything in one loop.
		    divs.each(function(div, index){
				var height = div.rowHeight;
		        var div2 = divs2[index];
		        div.setStyle('height' , ''+height);
		        div2.setStyle('height', ''+height);
		    });
		
			alert(event.target.innerHTML+': '+watch.duration());
		}	

		var syncRowHeightsWithoutCache = function(){
			var watch = new PWStopWatch(true);	
			me._ganttController.flushCachedHeightInOutlineRows();			
			me._ganttController.syncContentRowsHeights();
			alert('Time to sync height of '+me.rows().length+' rows without cache: '+watch.duration());
		}

		var syncRowHeightsWithCache = function(){
			var watch = new PWStopWatch(true);	
			me._ganttController.syncContentRowsHeights();
			alert('Time to sync height of '+me.rows().length+' rows with cache: '+watch.duration());
		}

		var updateGanttLines = function(event){
			var watch = new PWStopWatch(true);		
			me._ganttController.gantt.updateLines();
			alert(event.target.innerHTML+': '+watch.duration());
		}

		var toggleRowIndex = 9;
		var toggleRowExpansionState = function(event){
			var row = me.rows()[toggleRowIndex];
			var watch = new PWStopWatch(true);	
			me.toggleRowExpansionState(row);
			alert(event.target.innerHTML+': '+watch.duration());
		}

		var toggleRowExpansionStateWithoutSyncing = function(event){
			var row = me.rows()[toggleRowIndex];
			var watch = new PWStopWatch(true);
			me.refreshRowHeightsInUpdateGanttRowsVisibility = false;
			me.toggleRowExpansionState(row);
			me.refreshRowHeightsInUpdateGanttRowsVisibility = true;
			watch.logDuration('toggleRowExpansionStateWithoutSyncing');
			alert(event.target.innerHTML+': '+watch.duration());
		}
		
		createTestButton('Measure outline rows', measureOutlineRows);

		createTestButton('Measure gantt rows', measureGanttRows);

		createTestButton('Sync row heights (without cached heights)', syncRowHeightsWithoutCache);

		createTestButton('Sync row heights (with cached heights)', syncRowHeightsWithCache);

		createTestButton('Update gantt lines', updateGanttLines);

		createTestButton('Toggle expansion state of row #'+toggleRowIndex, toggleRowExpansionState);

		createTestButton('Toggle expansion state of row #'+toggleRowIndex+' without updating row heights', toggleRowExpansionStateWithoutSyncing);

		createTestButton('Measure outline and gantt rows table after table', measureOutlineAndGanttRows);

		createTestButton('Measure outline and gantt rows interleaved', measureOutlineAndGanttRowsInterleaved);

	},

    // A gantt row can have two different representations depending on it's expansion state.
    // So group rows are represented twice and only one should be visible.
    prepareAlternateGanttRows: function(){
        var lastRow;
        var lastLabelViewRow;
        var lastIndex;
	    var ganttRows = Array.clone(this._ganttController.visibleGanttRows());

        var labelViewRows = this.visibleLabelViewRows();
        var hasLabelViewRows = !!labelViewRows;

        ganttRows.each(function(row, idx){
            
            var index = row.getProperty('data-idx');
            row.index = index;

            var labelViewRow = hasLabelViewRows ? labelViewRows[idx] : null;
            row.labelViewRow = labelViewRow;

            if(index == lastIndex){
                lastRow.alternateRow = row;
                row.alternateRow = lastRow;
                row.parentElement.removeChild(row);

                if(labelViewRow){
                    lastLabelViewRow.alternateRow = labelViewRow;
                    labelViewRow.alternateRow = lastLabelViewRow;
                    labelViewRow.parentElement.removeChild(labelViewRow);
                }
            }
            
            lastLabelViewRow = labelViewRow;
            lastRow = row;
            lastIndex = index;
        });
    },
    
	createFlatGanttRows: function(){
	    this.flatGanttRows = this.flatRows.map(function(outlineRow){
	        return outlineRow.ganttRow;
	    });
	},
        
	ganttController: function(){
	    return this._ganttController;
	},
    
	ganttRows: function(){
		return this.rows().map(function(outlineRow){
			return outlineRow.ganttRow;
		});
	},
    
    labelViewBody: function(){
        return this._ganttController.secondScrollView.scrollView.getElementById('labelViewBody');
    },

    visibleLabelViewRows: function(){
        var labelViewBody = this.labelViewBody();
        if(labelViewBody)
           return labelViewBody.getElements('.row');
        return null;
    },
    
	linkOutlineRowsWithGanttRows: function(){
	    var ganttRows = this._ganttController.visibleGanttRows();
	    var outlineRows = this.flatRows;
	    outlineRows.each(function(outlineRow, index){
	        var ganttRow = ganttRows[index];
	        outlineRow.ganttRow = ganttRow;
	        ganttRow.outlineRow = outlineRow;
	    });
	},

	outlineRowforGanttRow: function(ganttRow){
	    return ganttRow.outlineRow;
	},

/*    
	    // Selects all rows inside the gantt which are also selected in the outline. Deselects other rows.
	applySelectionToGanttRow: function(row){
    
		console.log(row.ganttRow);
	
		return;
	
	    // TODO: make this more efficient
    
	    var selClass    = this.classOfSelectedRows;
	    var ganttRows   = this.ganttRows();
	    var outlineRows = this.rows();
	    var count       = outlineRows.length;
    
	    for(var i=0; i<count; i++)
	    {
	        var outlineRowIsSelected = outlineRows[i].hasClass(selClass);
	        var ganttRow             = ganttRows[i];
	        var ganttRowIsSelected   = ganttRow.hasClass(selClass);
	        if(outlineRowIsSelected && !ganttRowIsSelected)
	            ganttRow.addClass(selClass);
	        else if(!outlineRowIsSelected && ganttRowIsSelected)
	            ganttRow.removeClass(selClass);
	    }
	},
*/    
	    // Updates the invisible divs inside timePhaseSubrow1, 2 and 3 in order to change the height of the row.
	updateIntrinsicGanttRowHeightIfNeeded: function(ganttRow){
	    var timePhaseSubrows = ganttRow.getElements('.timePhaseSubrow1, .timePhaseSubrow2, .timePhaseSubrow3');
	    if(timePhaseSubrows.length > 0){
	        timePhaseSubrows.each(function(subrow){
	            this.updateIntrinsicHeightOfTimephaseSubrow(subrow);
	        }, this);
		}
	},
    
	updateIntrinsicHeightOfTimephaseSubrow: function(subrow){
    
	    // Get distinct classes from timephase boxes:
	    // TODO: Do not do this for every box. Instead manage a set with used classes
	    //       which is updated everytime a row is selected or deselected. Then this method
	    //       needs only to create invisible box elements with those classes.
	    var distinctBoxClasses   = {};
	    var distinctLabelClasses = {};
	    var boxes = subrow.getElements('.innerSubrow > .box');
        
	    if(boxes.length > 0){
	        boxes.each(function(box){
	            // Only take classes from visible boxes.
	            if(!box.hasClass('invisible')) {
	                distinctBoxClasses[box.className] = true;
	                var label = box.getChildren('.tplabel')[0];
                    if(label)
                        distinctLabelClasses[label.className] = true;
	            }
	        });
	    }

	    this.updateInvisibleBoxesInSubrow(subrow, distinctBoxClasses, distinctLabelClasses);
	},
    
	    // Note distinctBoxClasses and distinctLabelClasses must have the same count of elements.
	updateInvisibleBoxesInSubrow: function(subrow, distinctBoxClasses, distinctLabelClasses){
            
	    var invisibleBoxes = subrow.getElements('.innerSubrow > .box.invisible');
	    var oldLength = invisibleBoxes.length;
	    var newLength = Object.getLength(distinctBoxClasses);

	    if(newLength > oldLength){
	        // Create more boxes if needed:
	        for(;oldLength<newLength; oldLength++){
	            var box   = new Element('div');
	            var label = new Element('div');
	            label.inject(box);
	            box.inject(subrow);
	            invisibleBoxes.push(box);
	        }
	    }
                
	    // Let enough boxes take part in the layout:
        var newInvisibleBoxCount = Math.max(1, newLength);
	    invisibleBoxes.each(function(box, index){
	        box.setStyle('display', index < newInvisibleBoxCount ? 'inline-block' : 'none');
	    });
    
	    // Apply the right classes to each used invisible box:
	    if(newLength > 0) {
	        Object.keys(distinctBoxClasses).each(function(className, index){
	            var box = invisibleBoxes[index];
                var newClassName = className+' invisible';
	            if(box.className != newClassName)
                    box.className = newClassName;

	            var label = box.getChildren()[0];
                var newLabelClassName = 'tplabel invisibleText ' + distinctLabelClasses[index];
                if(label.className != newLabelClassName)
                    label.className = newLabelClassName;
	        });
	    }
	},
    
    // Fills the normal css classes cache of elements with a server side selection.
	prepareGanttRowsWithServerSideSelection: function(){
	    var selectedClassProperty = this.selectedClassProperty;
	    var notSelectedClassProperty = this.notSelectedClassProperty;
	    this.ganttController().ganttTable.getElements('['+notSelectedClassProperty+']').each(function(element){
            element.isNotSelectedClass = element.getProperty(notSelectedClassProperty);
	        element.setProperty(selectedClassProperty, element.getProperty('class'));
	    });

        var selClass = 'selected';
        this.ganttRows().each(function(ganttRow){
            var labelViewRow = ganttRow.labelViewRow;
            if(labelViewRow && ganttRow.hasClass(selClass))
               labelViewRow.addClass(selClass);
        });
	},

	toggleRowExpansionState: function(row){

		// Flush the cached height of the row
	    this.ganttController().flushCachedHeightInRows([row, row.ganttRow]);
		this.parent(row)
	},
 
	addSelectionStyleToRow: function(row){
	    this.parent(row);
        var ganttRow = row.ganttRow;
	    if(ganttRow) {
	        this.parent(ganttRow);
            var labelViewRow = ganttRow.labelViewRow;
            if(labelViewRow)
                this.parent(labelViewRow);
	        this.updateIntrinsicGanttRowHeightIfNeeded(row.ganttRow);
	    }
	},

	removeSelectionStyleFromRow: function(row){
	    this.parent(row);
        var ganttRow = row.ganttRow;
	    if(ganttRow) {
	        this.parent(ganttRow);
			this.removeRowFromSelection(ganttRow);
            var labelViewRow = ganttRow.labelViewRow;
            if(labelViewRow){
                this.parent(labelViewRow);
                this.removeRowFromSelection(labelViewRow);
            }
	        this.updateIntrinsicGanttRowHeightIfNeeded(ganttRow);
	    }
	},

	updateSelectionBorders: function(){
	    if(this.ganttController())
	        this.updateSelectionBordersInOutlineAndGantt();
	},
	
	updateSelectionBordersInOutlineAndGantt: function(){
//    	console.log('updateSelectionBordersInOutlineAndGantt');
	
		// This is roughly 16 times faster than the original implementation (0,016s -> 0,001s)

//		var watch = new PWStopWatch(true);
		
		var selectedOutlineRows = this.sortedRows(this.selectedOutlineRows());
		var visibleOutlineRows = this.rows();
		
		var previousRowsWithSelection = [];
		visibleOutlineRows.each(function(row){
			if(row.hasClass('selectionTop') || row.hasClass('selectionBottom') || row.hasClass('selected')){
				previousRowsWithSelection.push(row);
			}
		});

		if(selectedOutlineRows.length > 0){
        
			var count = visibleOutlineRows.length;
			var findVisibleIndexForRow = function(row, startIndex){
				var rowIndex = row.index;
				for(var i=startIndex; i<count; i++){
					var iRow = visibleOutlineRows[i];

					if(rowIndex == iRow.index)
						return i;
				}
				console.log('Error: selected row is not visible')
			}			
			
			var firstIndex = findVisibleIndexForRow(selectedOutlineRows[0], 0);
			var lastIndex  = findVisibleIndexForRow(selectedOutlineRows.getLast(), firstIndex);
			
			var selClass = 'selected';
		    var previousRow = null;
		    var previousGanttRow = null;
		    var previousLabelViewRow = null;

		    var previousRowIsSelected = false;
		
			count = lastIndex+1-firstIndex;

		    for(var i=firstIndex; i<=lastIndex; i++)
		    {
				var row = visibleOutlineRows[i];
				previousRowsWithSelection.erase(row);

		        var ganttRow = row.ganttRow;
		        var rows = [row, ganttRow];
                var labelViewRow = ganttRow.labelViewRow;
                if(labelViewRow)
                    rows.push(labelViewRow);
                    
		        var isSelected = row.hasClass(selClass);
		        if(!isSelected){
		            this.removeSelectionTopBorderFromRows(rows);
		            this.removeSelectionBottomBorderFromRows(rows);
		        }
                
                var previousRows = [previousRow, previousGanttRow];
                if(previousLabelViewRow)
                    previousRows.push(previousLabelViewRow);
                
		        if(!previousRowIsSelected && isSelected)
		            this.addSelectionTopBorderToRows(rows);
		        else if(!isSelected && previousRowIsSelected)
		            this.addSelectionBottomBorderToRows(previousRows);
		        else if(isSelected && previousRowIsSelected) {
		            this.removeSelectionBottomBorderFromRows(previousRows);
		            this.removeSelectionTopBorderFromRows(rows);
		        }
        
		        if(isSelected && i == lastIndex){
		            this.addSelectionBottomBorderToRows(rows);
		        }
                
		        previousRowIsSelected = isSelected;
		        previousRow = row;
		        previousGanttRow = ganttRow;
                previousLabelViewRow = labelViewRow;
		    }
		}

        // Deselect previously selected rows:
        var unselectedRows = [];
        previousRowsWithSelection.each(function(row){
            var ganttRow = row.ganttRow;
            unselectedRows.push(row);
            unselectedRows.push(ganttRow);
            var labelViewRow = ganttRow.labelViewRow;
            if(labelViewRow)
                unselectedRows.push(labelViewRow);
        });
        this.removeSelectionTopBorderFromRows(unselectedRows);
        this.removeSelectionBottomBorderFromRows(unselectedRows);

//        watch.logDuration('updateSelectionBordersInOutlineAndGantt_new');
        
	},

    selectedOutlineRows: function(){
		var outlineRows = [];
		this.selectedRows.each(function(row){
			if(row.ganttRow)
				outlineRows.push(row);			
		});
        return outlineRows;
    },
    
	removeRowsFromSelection: function(rows){
	    rows.each(function(row){
	        var index = row.index;
	        this.removeSelectionStyleFromRow(row);
	        var jointRows = [row];
	        if(row.ganttRow){
	            jointRows.push(row.ganttRow);
                var labelViewRow = row.ganttRow.labelViewRow;
                if(labelViewRow)
                    jointRows.push(labelViewRow);
            }
	        this.removeSelectionTopBorderFromRows(jointRows);
	        this.removeSelectionBottomBorderFromRows(jointRows);
	    }, this);
//	    this.updateSelectionBorders();
	},
    
	selectionStyleDidChangeInRowsWithIndex: function(rowsWithIndex){
	    this.parent(rowsWithIndex);
	    if(rowsWithIndex.length > 0){
	        var ganttComp = this.ganttController();

			// Flush the cached height in affected rows
			var affectedRows = [];
			rowsWithIndex.each(function(dict){
			   affectedRows.push(dict.row);
			});
			
			ganttComp.flushCachedHeightInRows(affectedRows);

			 // TODO compute the affected gantt rows
	        ganttComp.syncRowHeightsBetweenCorrespondingRows(ganttComp.visibleOutlineRows(), ganttComp.visibleGanttRows());

	        ganttComp.saveRowHeightsInInputField();
	        ganttComp.gantt.updateLines();        
	    }
	},
    
	updateRowsVisibility: function(rows){
	    this.parent(rows);

	    // If the gantt rows are still not connected to the outline rows, do nothing.
        var lastOutlineRow = rows.getLast();
	    if(lastOutlineRow && lastOutlineRow.ganttRow)
	        this.updateGanttRowsVisibility(rows);
	},

	refreshRowHeightsInUpdateGanttRowsVisibility: true, // DEBUG

	updateGanttRowsVisibility: function(relatedOutlineRows){		
	    var ganttController = this._ganttController;
	    var ganttTableBody = ganttController.ganttTable.getElement('tbody');	
        var labelViewTableBody = this.labelViewBody();
	    var lastVisibleOutlineRow = null;
        var classOfCollapsedRows = this.classOfCollapsedRows;
        var classOfSelectedRows = this.classOfSelectedRows;
        
        var me = this;
        var makeRowInvisible = function(row, parent){
            parent.removeChild(row);
            me.removeRowFromSelection(row);
        };
        
	    relatedOutlineRows.each(function(row, index){

            var outlineRowIsCollapsed = row.hasClass(classOfCollapsedRows);

            var ganttRow = row.ganttRow;
	        var ganttParentElement = ganttRow.parentElement;
	        var ganttRowIsInDOM = !!ganttParentElement;
    
            var labelViewRow = ganttRow.labelViewRow;
            var labelViewRowParentElement = labelViewRow ? labelViewRow.parentElement : null;

	        if(ganttRowIsInDOM && !row.isVisible){
                // Row becomes invisible
                makeRowInvisible(ganttRow, ganttParentElement);
                if(labelViewRow)
                    makeRowInvisible(labelViewRow, labelViewRowParentElement);
	        }else if(!ganttRowIsInDOM && row.isVisible){

                // Row becomes visible
                var visibleRow = this.visibleGanttRowForOutlineRow(row, outlineRowIsCollapsed);
                labelViewRow = visibleRow.labelViewRow;
                this.removeRowFromSelection(visibleRow);
                                
                if(lastVisibleOutlineRow)
	                visibleRow.inject(lastVisibleOutlineRow.ganttRow, 'after');
                else
	                ganttTableBody.appendChild(visibleRow);

                row.ganttRow = visibleRow;
                
                if(labelViewRow){
                    this.removeRowFromSelection(labelViewRow);
                    if(lastVisibleOutlineRow)
                        labelViewRow.inject(lastVisibleOutlineRow.ganttRow.labelViewRow, 'after');
                    else
                        labelViewTableBody.appendChild(labelViewRow);
                }
                
	        }else if(ganttParentElement){

                // Row stays but is changing content if needed
                var visibleGanttRow = this.visibleGanttRowForOutlineRow(row, outlineRowIsCollapsed);
                if(visibleGanttRow != ganttRow){
                     visibleGanttRow.replaces(ganttRow);
                     row.ganttRow = visibleGanttRow;
                
                    if(labelViewRow)
                        visibleGanttRow.labelViewRow.replaces(ganttRow.labelViewRow);

                    if(row.hasClass(classOfSelectedRows)){
                        this.exchangeRowInSelection(ganttRow, visibleGanttRow);
                        if(labelViewRow)
                            this.exchangeRowInSelection(ganttRow.labelViewRow, visibleGanttRow.labelViewRow);
                    }
                }
            }
            
	        if(row.isVisible)
	            lastVisibleOutlineRow = row;

	    }, this);

		// DEBUG
		if(!this.refreshRowHeightsInUpdateGanttRowsVisibility)
			return;

	    if(ganttController.gantt){
			// This is the expensive part:
			ganttController.syncContentRowsHeights(relatedOutlineRows);
	        ganttController.gantt.updateLines();
	    }
	},
    
    // Returns the row representing the given collapse state.
    visibleGanttRowForOutlineRow: function(outlineRow, shouldBeCollapsed){
        var ganttRow = outlineRow.ganttRow;
        if(this.options.clientSideCollapsingAndExpanding && outlineRow.hasClass('isCollapsible')){
            var ganttRowIsCollapsed = ganttRow.hasClass(this.classOfCollapsedRows);
            if(shouldBeCollapsed != ganttRowIsCollapsed)
                return ganttRow.alternateRow;
        }
        return ganttRow;
    },
    
    exchangeRowInSelection: function(oldRow, newRow){
        var classOfSelectedRows = this.classOfSelectedRows;
        var newIsSelected = newRow.hasClass(classOfSelectedRows);
        if(!newIsSelected)
            newRow.addClass(classOfSelectedRows);

        var selectionTopClass = 'selectionTop';
        var oldHasTopBorder = oldRow.hasClass(selectionTopClass);
        var newHasTopBorder = newRow.hasClass(selectionTopClass);
		
        if(oldHasTopBorder && !newHasTopBorder)
            newRow.addClass(selectionTopClass);
        else if(!oldHasTopBorder && newHasTopBorder)
            newRow.removeClass(selectionTopClass);
            
        var selectionBottomClass = 'selectionBottom';
        var oldHasBottomBorder = oldRow.hasClass(selectionBottomClass);
        var newHasBottomBorder = newRow.hasClass(selectionBottomClass);
        
		if(oldHasBottomBorder && !newHasBottomBorder)
            newRow.addClass(selectionBottomClass);
        else if(!oldHasBottomBorder && newHasBottomBorder)
            newRow.removeClass(selectionBottomClass);

        this.removeRowFromSelection(oldRow);
        this.selectedRows.push(newRow);
    },
    
    removeRowFromSelection: function(row){		
        row.removeClass(this.classOfSelectedRows);
        row.removeClass('selectionTop');
        row.removeClass('selectionBottom');
        this.selectedRows.erase(row);
    },
	
	addCollapsedStatusToRow: function(row){
		this.parent(row);
	},

	removeCollapsedStatusFromRow: function(row){
		this.parent(row);
	},
    
    toggleRowExpansionStateOnClientSideOnly: function(row){
        // In case this project is not exported, we still ask the server to toggle the expansion state
        // in order to save and to resolve subproject links.
        if(!this.options.isBeeingExported)
            this.options.toggleIsExpandedAction({'rowIndex':row.index});
        this.parent(row);
    },
    
    expandRowsOnClientSideOnly: function(rows){
        // In case this project is not exported, we still ask the server to expand rows
        // in order to save the state and resolve subproject links.
        if(!this.options.isBeeingExported){
            this.sendSelectionToServerIfNeeded();
            var rowIndices = this.expandableSelectedRows().map(function(row){
                return row.index;
            });
            if(rowIndices.length)
                this.options.expandSelectionAction({'rowIndices': JSON.encode(rowIndices)});
        }
        this.parent(rows);
    },
    
    collapseRowsOnClientSideOnly: function(rows){
        // In case this project is not exported, we still ask the server to collapse rows
        // in order to save the state.
        if(!this.options.isBeeingExported){
            this.sendSelectionToServerIfNeeded();
            var rowIndices = this.collapsibleSelectedRows().map(function(row){
                return row.index;
            });
            if(rowIndices.length)
                this.options.collapseSelectionAction({'rowIndices': JSON.encode(rowIndices)});
        }
        this.parent(rows);
    }
});


MEWGanttScrollviewController = new Class({
    
	Extends: WBLScrollComponentController,
    
    debugName: function(){
        return 'Gantt  ';
    },
    
    initialize: function(scrollView, options){
        if(!options)
            options = {};
        options.rowIndexBasedScrolling = true;
        this.parent(scrollView, options) ;
        //    console.log('••• initialize MEWGanttScrollviewController');
    },
        
    // Overwritten from WBLScrollComponentController in order to wait until the measurement element is ready too.
    onContentDocumentIsReady: function(callback, context){
        // Intentionally left blank. onReady is called by the gantt controller which holds the outline and the gantt together.
    },
    
});
