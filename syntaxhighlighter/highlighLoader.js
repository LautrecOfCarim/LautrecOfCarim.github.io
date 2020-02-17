eval(function()
{
try 
 {
	doHighlight();
 }
 catch(e)
 {
  var theBody = document.getElementsByTagName('body')[0];

  var elem = document.createElement('SCRIPT');
  elem.src="/syntaxhighlighter/scripts/shCore.js";
  theBody.appendChild(elem);

  elem = document.createElement('SCRIPT');
  elem.src="/syntaxhighlighter/scripts/shBrushHLSL.js";
  theBody.appendChild(elem);

  elem = document.createElement('SCRIPT');
  elem.src="/syntaxhighlighter/scripts/shBrushCSharp.js";
  theBody.appendChild(elem);

  elem = document.createElement('SCRIPT');
  elem.src="/syntaxhighlighter/scripts/shBrushCpp.js";
  theBody.appendChild(elem);

  elem = document.createElement('SCRIPT');
  elem.src="/syntaxhighlighter/dohighlight.js";
  theBody.appendChild(elem);
 }
})();