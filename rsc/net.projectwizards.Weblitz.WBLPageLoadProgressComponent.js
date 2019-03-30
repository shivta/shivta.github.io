var PWPrepareForPageLoadProgress = function()
{
	window.addEvent("domready",function(){

        var html=document.body.getParent();
		var shield=new Element('div',{
		  	'styles':{
				'position':'fixed',
				'width':'100%',
				'height':'100%',
				'top':'0px',
				'left':'0px',
				'background-color':document.body.getStyle('background-color')
		}});
		shield.inject(html);
	    
        var spinner=new Spinner().spin(shield);
	
		function replaceContent(executeScripts){
			var noScriptElement = $('pageContent');
			var realContent     = noScriptElement.textContent;
			var contentHolder   = noScriptElement.getParent();
			contentHolder.innerHTML=realContent;
        
			PWWaitUntilDomIsReadyAndIFramesInWindowAreLoaded(window,function(){
                if(executeScripts) {
                    var codes=document.body.getElementsByTagName("script");
                    for(var i=0;i<codes.length;i++){
                        eval(codes[i].text)
                    }
                }
               // console.log('first load: '+executeScripts);                                     
                if(executeScripts) {
                    shield.set('tween', {onComplete:function(){
                            spinner.stop();
                            shield.destroy()
                        }, duration:'long'
                    }).fade(0);
                }
                else {
                    spinner.stop();
                    shield.destroy()
                }
			})
		}
        
        // Do not execute scripts after the first page load.
        // For updates after the initial page load, WBLAjaxUpdateContainer is responsible.
        replaceContent(!window.scriptsInitiallyExcuted);
        window.scriptsInitiallyExcuted = true;
    });
}
