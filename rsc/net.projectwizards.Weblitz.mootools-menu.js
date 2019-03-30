/*
 ---
 description: This provides a simple Drop Down menu with infinite levels

 license: MIT-style

 authors:
 - Arian Stolwijk, Andreas Känner

 requires:
 - Core/Class.Extras
 - Core/Element.Event
 - Core/Selectors

 provides: [MooDropMenu, Element.MooDropMenu]

 ---

 Note: The menu works like a menu in Mac OS X.
 - The menu isn't active until you click inside a menu item.
 - A menu stays open until you click outside of it or select another menu item.
 - It supports separator items and disabled items.

 MooDropMenu also gathers keyboard shortcuts from list items and then adds a shortcut description
 to each item. Each shortcut is attached to a global keyboard (see setupKeyboardShortcuts).
 If the keyboard does not exist, it is created and activated.
 Keyboard shortcuts can be attached to a list item by adding a data-shortcut attribute to it.
 See http://mootools.net/docs/more/Interface/Keyboard.Extras for the syntax.
 */

var MooDropMenu = new Class({

    Implements: [Options, Events, Chain],

    options: {
        onOpen: function(el) {
            el.removeClass('close').addClass('open');
        },

        onClose: function(el) {
            el.removeClass('open').addClass('close');
            this.setInactiveIfPossible();
        },

        onInitialize: function(el) {
            el.removeClass('open').addClass('close');
        },
        listSelector: 'ul',
        itemSelector: 'li',
        openEvent: 'mouseenter',
        closeEvent: 'mouseleave',
        disabled: false,
        // If true the menu is completely disabled and does not react on user input
        delegate: null // menuDidBecomeActive and menuDidBecomeInactive is called on the delegate
    },

    // Is called when a MooDropMenu object is created.
    // "menu" must be of the kind stored in options.listSelector. Normally this is an 'UL' element.
    // See options at the start of the MooDropMenu definition for options.
    initialize: function(menu, options) {
        var controller = this;
        var menu = this.menu = document.id(menu);
		menu.controller = this;
        this.setOptions(options);
        options = this.options;
		
        if (!options.disabled) {
            // Register shortcut keys and add a description of them to menu items.
            this.setupKeyboardShortcuts();

            // React on a click outside active menus:
            controller.setupClickOutsideHandler();

            // Add the "subMenuItem" class to each item containing a sub menu:
            this.addSubmenuArrowsToItemsInMenu(menu, options);
        }
		
		// Prepare all action items by moidifying their onclick handler in order to make sure a click into this item
		// does not trigger the menu restoring mechanism:
		this.actionItems().each(function(item) {
			var origFunction = item.onclick;
			var me = this;
			item.onclick = function(){
				controller.didClickMenuItem = true;	
				origFunction();
				controller.didClickMenuItem = false;
			};
		});
		
        // Prepare top level items:
        this.topLevelMenuItems().each(function(item) {

            // Mark topLevel items by adding the class "topLevel":
            item.addClass('topLevel');

            if (!options.disabled) {
                // Add a click handler. performActionOnTarget is only set if this event is fired by the mouseUpAction.
                // See further down.
                item.addEvent('mousedown', function(event) {
					// Post an event to the Event Bus before we show anything:
					window.parent.eventBus().postNotification(MooDropMenu.WillShowMenuNotification);
					
                    var target = event.target;
                    controller.mouseDownTime = (new Date()).getTime();
                    controller.mouseDownTarget = target;

                    // This is the list item, the user has clicked into:
                    var listItem = controller.listItemForEventTarget(target);

                    function click() {
						controller.toggleActiveState();
                        if (menu.hasClass('active')) {
							item.fireEvent(options.openEvent, item);
                        } else {
							controller.closeOwnMenu();
                        }
                    }

                    // The following code lets the selected item blink for a short time before the 
                    // click method is called:
                    // Don't blink for top level items:
                    if (listItem == item) {
                        click();
                        // Don't blink for disabled items and items with an attached submenu:
                    } else if (!listItem.getElement(options.listSelector) && !listItem.hasClass('disabled')) {
							
                        listItem.addClass('disabled');
                        (function() {
                            listItem.removeClass('disabled');
                        }).delay(100);
                        (function() {
                            click();
                        }).delay(200);

                    }

                    // Call the onclick method of the list item if requested. See mouseUpAction below.
                    if (event.performActionOnTarget && listItem.onclick){
						listItem.onclick(event);
					}

					// Close foreign menus:
					controller.closeForeignActiveMenu();

                    // Stop propagating this event:
                    return false;
                });

                item.addEvent('mouseup', function(event) {
                    var now = (new Date()).getTime();
                    if (controller.mouseDownTarget != event.target || (now - controller.mouseDownTime) > 200) {
                        event.performActionOnTarget = true;
						
						item.fireEvent('mousedown', event);
						
                    }
                });
            }
        });

        if (!options.disabled) {
            // On mouse enter mark the related item as being under the mouse and close not related sub menus:
            menu.getElements(options.itemSelector).each(function(item) {
                item.addEvent(options.openEvent, function() {
                    item.store('isMouseOver', true);
                    controller.closeSubMenus();
                }.bind(this));

                // Because the :hover selector does not work in webkit if a mouse button is down, 
                // we fake an own hover on span elements 
                var span = item.getElement('span');
                if (span) {
                    span.addEvent('mouseenter', function() {						
                        span.addClass('hover');
//						controller.saveState();
                    }.bind(this));
                    span.addEvent('mouseleave', function() {
                        span.removeClass('hover');
//						controller.saveState();
                    }.bind(this));
                }
            });
        }

        // For each item containing a sub menu add a mouse enter and mouse leave event handler:
        menu.getElements(options.itemSelector + ' > ' + options.listSelector).each(function(list) {
            this.fireEvent('initialize', list);
            if (!options.disabled) {
                var item = list.getParent(options.itemSelector);
                item.addEvent(options.openEvent, function() {
                    // Highlight the item if the menu is active and open the menu:
                    if (menu.hasClass('active')) {
                        item.addClass('highlight');
                        this.fireEvent('open', list);
                    }
                }.bind(this));

                // Remove the isMouseOver flag on mouse leave:
                item.addEvent(options.closeEvent, function() {
                    item.store('isMouseOver', false);
                }.bind(this));
            }
        }, this);

		this.restoreState();
    },

	dispose: function(){
		if(this.didClickMenuItem)
			this.flushState();
		else
			this.saveState();
		didClickMenuItem = false;
	},

	logState: false,

	// Save the xPath of the selected menu item so we can restore it later.
	saveState: function(){
		var prefsContainer = this.options.prefsContainer;
		var prefsName      = this.options.prefsName;
		if(prefsContainer && prefsName)
		{
			var state = {};
			var options = this.options;
			var menu = this.menu;
                            
            if(!menu.hasClass('active')){
                prefsContainer[prefsName] = undefined;
                return;
            }
            
			/*
			// This is an alternative to the code below. The path to item under the mouse is saved in contrast to the method below.
			// which only saves the path to a top level item. In order to make this work, saveState has to be called at various places. 
			// Not only in dispose.
	        if(menu.hasClass('active'))
				menu.getElements(options.itemSelector).each(function(item) {
					var span = item.getElement('span');
		            if(span && span.hasClass('hover')){
						console.log('SAVE item xPath = '+Element.getElementXPath(item)+' name = '+item.getElement('span').innerHTML);
						prefsContainer['prefsName'] = Element.getElementXPath(item);
						return;
	                }
		    }, this);
			*/
			// Note: This only gets the item for a top level menu if saveState is called from within dispose.
			//       It goes like this: On moused down in a top level item a MooDropMenu.WillShowMenuNotification notification is posted.
			//       If needed, an outline view sends it's selection to the server and replaces the main menu with the update container mechanism.
			//       Then MooDropMenu.dispose and saveState is called. The only selected item at this point in time is a top level item.
			//       It could take some more seconds before the menu is replaced. So the user is able to select items from the "old" menu.
			//       This is normaly no problem, because the top level item will be opened again after the menu has been exchanged and the browser 
			//       will fire all related mouse events again. This works in FF, Safari and partly in Chrome. Chrome does not highlight the exchanged menu item.
			//       In IE this does not work.
			menu.getElements(options.itemSelector + ' > ' + options.listSelector).each(function(list) {
			                var item = list.getParent(options.itemSelector);
			                if(item.retrieve('isMouseOver')){
								if(this.logState)
									console.log('SAVE item cssPath = '+Element.cssPath(item));
								prefsContainer[prefsName] = Element.cssPath(item);
								return;
			                }
				        }, this);
			
		}
	},
	
	// Restore a previously stored state. Show menus etc. if needed.
	restoreState: function(){
		var prefsContainer = this.options.prefsContainer;
		var prefsName      = this.options.prefsName;
		if(prefsContainer && prefsName)
		{
			var cssPath = prefsContainer[prefsName];
			if(cssPath !== undefined){
				var items = $$(cssPath);
				if(items.length > 0){
					var item = items[0];
					if(this.logState)
						console.log('RESTORE cssPath: '+cssPath+' item: '+item);				
					this.selectAndShowMenuItem(item);
				}
			}
		}
	},
	
	flushState: function(){
		var prefsContainer = this.options.prefsContainer;
		var prefsName      = this.options.prefsName;
		if(prefsContainer && prefsName){
			if(this.logState)
				console.log('FLUSH STATE');				
			prefsContainer[prefsName] = undefined;
		}
	},
	
	selectAndShowMenuItem: function(item){
		var fireEvent = function(element, event) {
		    var evt;
		    var isString = function(it) {
		        return typeof it == "string" || it instanceof String;
		    }
		    element = (isString(element)) ? document.getElementById(element) : element;
		    if (document.createEventObject) {
		        // dispatch for IE
		        evt = document.createEventObject();
		        return element.fireEvent('on' + event, evt)
		    }
		    else 
			{
		        // dispatch for firefox + others
		        evt = document.createEvent("HTMLEvents");
		        evt.initEvent(event, true, true); // event type,bubbling,cancelable
		        return !element.dispatchEvent(evt);
		    }
		}
		fireEvent(item, 'mouseenter');	
		fireEvent(item, 'mousedown');		
	},
	
	
	
	// This is called when the menu is closed
	makeMenuInactive: function(){
		this.menu.removeClass('active');
		// Remove the state which is only used to restore a previously opened menu.		
		this.flushState();
	},
	
    // Adds arrows to items which have an attached submenu.
    // This is done by adding the css class "subMenuItem" to the list item.
    addSubmenuArrowsToItemsInMenu: function(menu, options) {
        var options = this.options;
        menu.getElements(options.itemSelector).each(function(el) {
            if (el.getElement(options.listSelector)) el.addClass('subMenuItem');
        });
    },

    // Returns the top level menu items - those which are directly visible inside the menu bar.
    topLevelMenuItems: function() {
        return this.menu.getChildren(this.options.itemSelector);
    },

	// Returns all 'li' items with an onclick handler attached:
	actionItems: function(){
		return this.menu.getElements('li').filter(function(item){
			return item.onclick;
		});
	},

    // Toggle the active state of the main menu.
    toggleActiveState: function() {
        var menu = this.menu;
        menu.toggleClass('active');

        // Inform the delegate:
        var delegate = this.options.delegate;
        if (delegate) {
            if (menu.hasClass('active')) delegate.menuDidBecomeActive.call(delegate, this);
            else delegate.menuDidBecomeInactive.call(delegate, this);
        }
    },

    // If no sub menu is selected, set the menu inactive.
    setInactiveIfPossible: function() {
        if (!this.topLevelMenuItems().some(function(item, index) {
            return item.hasClass('highlight');
        })) {
            this.makeMenuInactive();
        }
    },

    // Returns all menu items.
    allMenuItems: function() {
        return this.menu.getElements(this.options.itemSelector);
    },

    // If closeAll is false, this closes sub menus which are still highlighted but without a mouse over it.
    // If closeAll is true, all sub menus will be closed.
    closeSubMenus: function(closeAll) {

//        console.log('closeSubMenus');

        var controller = this;
        var options = this.options;
        this.allMenuItems().each(function(item) {
            if (closeAll || (item.hasClass('highlight') && !item.retrieve('isMouseOver'))) {
                item.removeClass('highlight');
                var list = item.getElement(options.listSelector);
                if (list) list.removeClass('open').addClass('close');
            }
        });
    },

    // Returns the first list item which is an ancestor of target.
    listItemForEventTarget: function(target) {
        if (this.menu.contains(target)) {
            var itemSelector = this.options.itemSelector.toUpperCase();
            if (target.tagName == itemSelector) return target;
            var parent = target.getParent();
            if (parent) {
                do {
                    if (parent.tagName == itemSelector) return parent;
                    parent = parent.getParent();
                } while (parent && parent.tagName != this.options.itemSelector);
            }
        }
        return null;
    },

	closeOwnMenu: function() {
        this.makeMenuInactive();
        this.closeSubMenus(true);
        var delegate = this.options.delegate;
        if (delegate) 
        	delegate.menuDidBecomeInactive.call(delegate, this);	
	},

    // Observes clicks outside the menu and closes all menus if needed.
    // After that the menu is made inactive.
    setupClickOutsideHandler: function() {
        var controller = this;
        PWWaitUntilDomIsReadyAndIFramesInWindowAreLoaded(window, function(){
            (function(){
                function clickOutsideHandler(event){					
                    // Only close the menu if it is active and if the mouse target is not inside the menu:
                    if (!controller.listItemForEventTarget(event.target) && controller.menu.hasClass('active'))
                        controller.closeOwnMenu();
                }
                
                function prepareHTMLElement(htmlElement){
                    if(htmlElement.addEvent){
                        htmlElement.addEvent('mouseup', function(event){clickOutsideHandler(event);});
                        htmlElement.addEvent('mousedown', function(event){clickOutsideHandler(event);});
                    }
                }

                prepareHTMLElement(document.body.getParent());
                
                var iFrames = $$('iframe');
                var count   = iFrames.length;
                for(var i=0; i<count; i++){
                    // Note: in IE11 the body element is only != null after a second or so. Need to investigate further.
					var iFrameBody = iFrames[i].contentWindow.document.body;
                    if(iFrameBody){
                        prepareHTMLElement(iFrameBody);
					}
                }
            }).delay(300, controller); // TODO: Find out why we need this delay
        });
    },

	foreignActiveMenu: function() {
		var ownMenu = this.menu;
		var result  = null;
		$$('.menu').each(function(menu, index){
			if(menu != ownMenu && menu.hasClass('active'))
				result = menu;
		}); 
		return result;
	},

	closeForeignActiveMenu: function() {
		var foreignActiveMenu = this.foreignActiveMenu();
		if(foreignActiveMenu)
			foreignActiveMenu.controller.closeOwnMenu();		
	},

    // '⌘⇧^⌥';
    macOSShortcutMapping: {
        'META': '⌘',
        'ALT': '⌥',
        'CTRL': '^',
        'SHIFT': '⇧',
        '\\+': '',
		'RIGHT': '→',
		'LEFT': '←',
		'UP': '↑',
		'DOWN': '↓'
    },

    otherOSShortcutMapping: {
        'META': 'Win',
        'ALT': 'Alt',
        'CTRL': 'Ctrl',
        'SHIFT': '⇧',
		'RIGHT': '→',
		'LEFT': '←',
		'UP': '↑',
		'DOWN': '↓'
    },

    visibleShortcutForShortcut: function(shortcut) {
        var isMacOS = navigator.appVersion.indexOf("Mac") != -1;
        var mapping = isMacOS ? this.macOSShortcutMapping : this.otherOSShortcutMapping;
        shortcut = shortcut.toUpperCase();
        for (var key in mapping) {
            shortcut = shortcut.replace(RegExp(key, 'g'), mapping[key]);
        }
		// 'plus' is the marker for '+'. Replace it here:
		shortcut = shortcut.replace('PLUS', '+', 'g');	
        return shortcut;
    },

    addShortcutToItem: function(item, shortcut) {
        var div = new Element('div', {
            class: 'shortcut'
        });
        div.innerHTML = this.visibleShortcutForShortcut(shortcut);
        div.inject(item.getElement('span'));
    },

    setupKeyboardShortcuts: function() {
        var menu = this.menu;
		var me = this;
        if (!window.keyboard) {
            window.keyboard = new Keyboard();
            window.keyboard.activate();
        }
        var keyboard = window.keyboard;

        var controller = this;
        Array.each(this.allMenuItems(), function(item, index) {
            var shortcut = item.getAttribute('data-shortcut');
            if (shortcut) {
                // Prepare item to show the shortcut:
                controller.addShortcutToItem(item, shortcut);

                // Only register enabled shortcuts:
                if (!item.hasClass('disabled') && item.onclick) {
                    function handler(event) {
						// Post an event to the Event Bus before we show anything:
						window.parent.eventBus().postNotification(MooDropMenu.WillShowMenuNotification);
						
//                        console.log('shortcut pressed: '+shortcut);
                        
                        // Close all menus (in case a shortcut is pressed when a menu is open).
                        controller.closeSubMenus(true);

                        // Highlight the related top level item for a short time:
                        var topItem = item.getParent('.topLevel');
                        me.menu.addClass('active');
                        topItem.addClass('highlight');
                        (function() {
                            me.makeMenuInactive();
                            topItem.removeClass('highlight');
                        }).delay(100);

                        // Call the onclick action method:
                        item.onclick.bind(item)();
                        event.preventDefault();
                    }

					// Remove the previously registered shortcut
					if(keyboard.getShortcut(shortcut))
						keyboard.removeShortcut(shortcut);
					
					// Note: We register the shortcut under its own definition:
					keyboard.addShortcut(shortcut, {
						'keys': shortcut,
						'handler': handler
					});
                }
            }
        });
    },

    toElement: function() {
        return this.menu
    }

});

MooDropMenu.WillShowMenuNotification = 'WillShowMenuNotification';

/* So you can do like this $('nav').MooDropMenu(); or even $('nav').MooDropMenu().setStyle('border',1); */
Element.implement({
    MooDropMenu: function(options) {
		var menu = new MooDropMenu(this, options);
        this.store('MooDropMenu', menu);
		return menu;
    }
});

function prepareMainMenu() {
	var element = $$('.menu')[0];
    //console.log('prepareMainMenu menu: '+element+' body: '+($$('body')[0]).innerHTML);

    if(element) {
        var menu = element.MooDropMenu({mouseoutDelay:20, prefsContainer:window.parent, prefsName:'mainMenu'});
        PWAutoreleasePool.addObjectToPoolForElement(menu, element);
    }
}
