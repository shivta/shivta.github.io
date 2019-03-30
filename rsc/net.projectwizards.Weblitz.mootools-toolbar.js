PWToolbarItem = new Class({
    Implements: [Options],

    options: {
		wholeItemIsMouseSensitive:false	
    },

	showNormal: function(){
		this.mainImage.setStyle('opacity', '1.0');
		if(this.options.wholeItemIsMouseSensitive)
			this.label.setStyle('opacity', '1.0');
	},

	showPressed: function(){
		this.mainImage.setStyle('opacity', '0.75');	
		if(this.options.wholeItemIsMouseSensitive)
			this.label.setStyle('opacity', '0.75');
	},

    useHighResImages: function() {
        return window.devicePixelRatio && window.devicePixelRatio > 1;
    },

	imageName: function(baseImageName){
		var result = baseImageName;
		if(result && this.useHighResImages()){
			var suffixStart = baseImageName.lastIndexOf('.');
			if(suffixStart != -1) {		
				result = baseImageName.substring(0, suffixStart);
				result += "@2x"+baseImageName.substring(suffixStart);
			}
		}
		return result;
	},

    updateMainImageURL: function() {
        var mainImageName = this.imageName(this.itemElement.getProperty('data-image'));
        if(mainImageName)
            this.mainImage.setStyle('background-image', 'url('+mainImageName+')');
    },

    setupMainImage: function() {
        this.updateMainImageURL();
        if(window.devicePixelRatio)
            window.matchMedia("(-webkit-device-pixel-ratio:1)").addListener(this.updateMainImageURL.bind(this));
    },
                          
	initialize: function(itemElement, options){
		this.setOptions(options);
		options = this.options;

		this.itemElement = itemElement;
        var label        = itemElement.getElement('.label');
		this.label       = label;
        var mainImage    = itemElement.getElement('.image');
        this.mainImage   = mainImage;
        
        this.setupMainImage();

		// Make the item unselectable (see http://stackoverflow.com/questions/826782/css-rule-to-disable-text-selection-highlighting).
		// For other browsers see css file.
		itemElement.setProperty('unselectable', 'on')
                          
        var menu = itemElement.getElement(".menu");
		var onDirectMouseDown = itemElement.getProperty('data-ondirectmousedown');
		var controller = this;
		this.isMenuOnly = menu && !onDirectMouseDown;
		if(this.isMenuOnly)
			itemElement.addClass('menuonly');

		var showPressed = function () {
			controller.showPressed();
		};
		var showNormal = function () {
			controller.showNormal();
		};

		showNormal();			
					
		var isDisabled = itemElement.hasClass("disabled");

		// Only react on clicks if we are not disabled:
		if(!isDisabled && onDirectMouseDown) {		
			var sensitiveElement = options.wholeItemIsMouseSensitive ? itemElement : mainImage; 

            var onMouseUp = function(event) {
                showNormal();
                removeEventListeners();
                
                if (onDirectMouseDown && (event.target == sensitiveElement || sensitiveElement.contains(event.target))) {
                    eval(onDirectMouseDown);
                }
            };
                                                    
            var removeEventListeners = function() {
				window.removeEvent('mouseup', onMouseUp);
				sensitiveElement.removeEvent('mouseenter', showPressed);	
				sensitiveElement.removeEvent('mouseleave', showNormal);
            };
			
			if(!controller.isMenuOnly) {
				sensitiveElement.addEvent('mousedown', function(event){
					showPressed();				
					sensitiveElement.addEvent('mouseenter', showPressed);	
					sensitiveElement.addEvent('mouseleave', showNormal);
					window.addEvent('mouseup', onMouseUp);
				});
            }                          
		}

		if(menu)
			menu.MooDropMenu({mouseoutDelay: 20, disabled:isDisabled, delegate:this});	
	},
	
	menuDidBecomeActive: function (menuController) {
		this.showPressed();
	},
	
	menuDidBecomeInactive: function (menuController) {
		this.showNormal();
	}
	
});

function prepareToolbar(toolbar, itemOptions) {
    var toolbarItems = toolbar.getElements('.item');
	Array.each($$(toolbarItems), function(item, index){
		new PWToolbarItem(item, itemOptions);
	});	
}

function prepareToolbarsWithSelector(toolbarClass, itemOptions) {
    Array.each($$(toolbarClass), function(toolbar, index){
        if(!toolbar.getProperty('isPrepared')){
            prepareToolbar(toolbar, itemOptions);
            toolbar.setProperty('isPrepared', 'true');
        }
    });               
}