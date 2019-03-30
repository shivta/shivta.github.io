// This method loads all Javascript files used in the parent window also into the frame window.
// This is done synchronously. Therefore all scripts can be used immediately.
// Call this method from within a script tag within the frames head section.
function includeJavascriptFilesUsedInParentWindow() {	

    function loadScriptSynchronously(src) {
        document.writeln("<script type='text/javascript' src='"+src+"'></script>");
    }
    
    function scriptSourcesFromWindow(win) {
        var scripts = win.document.getElementsByTagName('script');
        var sources = [];
        for(var i=0; i<scripts.length; i++) {
            var src = scripts[i].src;
            if(src.length > 0)
                sources.push(src);
        }
        return sources;
    }
    
    var frameScriptSources  = scriptSourcesFromWindow(window);
    var parentScriptSources = scriptSourcesFromWindow(window.parent);
    	
    for(var i=0; i<parentScriptSources.length; i++){
        var src = parentScriptSources[i];
        if(frameScriptSources.indexOf(src) == -1) {
            loadScriptSynchronously(src);
        }
    }
}

// Same as above, but loads CSS files and also imports <style>…</style> sections.
function includeCSSUsedInParentWindow() {

    // Load CSSS files
    function loadCSSFile(href)
    {
        document.writeln('<link type="text/css" rel="stylesheet" href="'+src+'">');
    }
    
    function cssFilesFromWindow(win) {
        var links = win.document.getElementsByTagName('link');
        var sources = [];
        for(var i=0; i<links.length; i++) {
            var link = links[i];
            if(link.href.length > 0 && link.type == "text/css" && link.rel == "stylesheet")
                sources.push(link.href);
        }
        return sources;
    }
    
    var frameCSSFiles  = cssFilesFromWindow(window);
    var parentCSSFiles = cssFilesFromWindow(window.parent);
    
    for(var i=0; i<parentCSSFiles.length; i++){
        var src = parentCSSFiles[i];
        if(frameCSSFiles.indexOf(src) == -1) {
            loadCSSFile(src);
        }
    }

    // Import <style>…</style> sections:
    var parentStyles = window.parent.document.getElementsByTagName('style');
    for(var i=0; i<parentStyles.length; i++){
        var element = parentStyles[i];
        document.writeln('<style>'+element.innerHTML+'</style>');
    };
    
}

// The result from this method is a text with a "<script>…</script>" definition in it.
// It is meant to be embedded inside the content of an iframe.
// It loads all javascript code found inside the head of the given document into the iframe context.
// It also loads all CSS links and embedded CSS definitions found inside the given document.
function scriptForLoadingJavascriptAndCSSFromDocument(doc, includeInlineScripts)
{
	var result = '<script>function textFromURL(url){var r=null;var oReq = new XMLHttpRequest();oReq.onload = function(){r=this.responseText;};oReq.open(\'get\', url, false);oReq.send();	return r;}';
	result += 'function importCSSFromURL(url){var css=textFromURL(url); var s=document.createElement(\'style\');s.appendChild(document.createTextNode(css));document.getElementsByTagName(\'head\')[0].appendChild(s);}';
	
	// Scripts:
	var scripts = doc.head.getElements('script');
	for(var i=0; i<scripts.length; i++) {
		var script = scripts[i];		
		if(script.src.length > 0)
			result+='\neval(textFromURL(\''+script.src+'\'));'
		else if(includeInlineScripts)
		 	result+=script.textContent;
	}

	// CSS files:	
	var linkElements = doc.getElementsByTagName('link');
	for(var i=0; i<linkElements.length; i++){
		var link = linkElements[i];
		if(link.href.length > 0 && link.rel == 'stylesheet')
			result+='\nimportCSSFromURL(\''+link.href+'\');';
	}		
	result += '</script>';

	// Inline CSS:
	var styles = doc.getElementsByTagName('style');
	for(var i=0; i<styles.length; i++) {
		var text = styles[i].textContent;
		if(text.length > 0)
			result+='\n<style>'+text+'</style>';
	}	
	return result;	
}

function WBLIFramePrepare(iFrame) {
    // Create an eventBus for the iFrame:
    iFrame.eventBus = new EventBus();

//	iFrame.PWUniqueID = createUniqueID();
//	console.log('*** prepare an iFrame '+iFrame.PWUniqueID);

    PWWaitUntilIFrameIsLoaded(iFrame, function(){
    
        // Exchange the setStyle method in order to forward overflow styles to the appropriate element inside the iframe,
        // because overflow values on the iFrame have no effect.

        var overflowElement = PWBrowserIsFirefox() ? iFrame.contentDocument.getElementsByTagName('html')[0] : iFrame.contentDocument.body;
        
        // On load simply transfer the overflow values to the element inside the iframe:
        var overflowStyles = ['overflow', 'overflow-x', 'overflow-y'];
        var count = overflowStyles.length;
        for(var i=0; i<count; i++){
            var style = overflowStyles[i];
            overflowElement.setStyle(style, iFrame.getStyle(style));
        }
        
        // Exchange the setStyle method:
        iFrame.oldSetStyle = iFrame.setStyle;
        iFrame.setStyle = function(key, value){
            // Because we always set the overflow style on the iFrame we do not need to overwrite the getStyle method.
            iFrame.oldSetStyle.call(iFrame, key, value);
            if(key == 'overflow-y' || key == 'overflow-x' || key == 'overflow') // TODO: use indexOf = -1
                overflowElement.setStyle(key, value);
        }
    });
}

function URLOfIFrameBootJS() {
    var scripts = window.document.getElementsByTagName('script');
    var sources = [];
    for(var i=0; i<scripts.length; i++) {
        var src = scripts[i].src;
        if(src.length > 0 && src.contains('WBLIFrameComponent.js'))
            return src;
    }
    return null;
}

function postIFrameDidLoadIfNeeded(){
	var postDidLoadFrame = function(){
		// Is sometimes called multiple times, so we need to check the ready state:	
		if(document.readyState=="complete"){
			//document.removeEvent("readystatechange", postDidLoadFrame);
			if(!window.frameIsLoaded){
				window.frameIsLoaded=true;
				window.eventBus().postNotification("iFrameDidLoad");
			}
		}
	}
	
	if(document.readyState=="complete")
		postDidLoadFrame();
	else 
		document.addEvent("readystatechange", postDidLoadFrame);
}
