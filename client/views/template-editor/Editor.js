/*
Editor
Eitable source code for a given template.
Updates the DOM as the user makes edits.

The editable CSS, Template HTML, and other code blocks are stored in 
the database as simple string fields on a TemplateCollection document.
The code is then 'rendered' into an output div.

The text editors are CodeMirror instances : http://codemirror.net/

*/

Template.Editor.created = function(){

  this.htmlError = new ReactiveVar;
  this.htmlError.set("ok");

  this.cssError = new ReactiveVar;
  this.cssError.set("ok");

  this.jsonError = new ReactiveVar;
  this.jsonError.set("ok");
}


Template.Editor.rendered = function(){

  this.cssEditor = 'not set';
  this.htmlEditor = 'not set';
  this.jsEditor = 'not set';
  this.jsonEditor = 'not set';
  this.renderedView = null; // Blaze View object we are rendering dynamically
  this.style = "not set"  // StyleSheet appended to the <head>
  this.observer = "not set";
  startObservers(this);

}

Template.Editor.helpers({
  currentTemplate : function(){
    if(this){
      var id = this.toString();
      var current = CurrentTemplate.findOne({_id:id});
      if(current){
        return current;
      }
    }
  },
  htmlError : function(){
    return Template.instance().htmlError.get();
  },
  htmlErrorClass : function(){
    return Template.instance().htmlError.get()==="ok" ? "errorPanel ok" : "errorPanel";
  },
  cssError : function(){
    return Template.instance().cssError.get();
  },
  cssErrorClass : function(){
    return Template.instance().cssError.get()==="ok" ? "errorPanel ok" : "errorPanel";
  },
  jsonError : function(){
    return Template.instance().jsonError.get();
  },
  jsonErrorClass : function(){
    return Template.instance().jsonError.get()==="ok" ? "errorPanel ok" : "errorPanel";
  } 
});


Template.Editor.destroyed = function(){

  this.observer.stop();

  if(!!this.renderedView){

    destroyCSS();
    Blaze._destroyView(this.renderedView);
    this.renderedView._domrange = null;
    this.renderedView = null;
  }
  
};


var startObservers = function(self){

  var templateId  = self.data._id; 
  var userId = Session.get('userId'); 

  self.observer = CurrentTemplate.find({_id:templateId}).observeChanges({

    added : function(id,doc){

      self.htmlEditor = new TextEditor('html-editor','text/html','html'+templateId); 
      self.htmlEditor.setValue(doc.html);
      self.htmlEditor.debounce("change",saveHTML,templateId,userId);
      self.htmlEditor.on("change",renderHTML,"html",self);  
      renderHTML(doc.html,"html",self);

      self.jsEditor = new TextEditor('js-editor','text/javascript','js'+templateId);
      self.jsEditor.setValue(doc.js);
      self.jsEditor.debounce("change",saveJS,templateId,userId);
      self.jsEditor.on("change",renderHTML,"js",self);  
      renderHTML(doc.js,"js",self);  

      self.cssEditor = new TextEditor('css-editor','text/css','css'+templateId);
      self.cssEditor.setValue(doc.css);
      self.cssEditor.debounce("change",saveCSS,templateId,userId);
      self.cssEditor.on("change",renderCSS,"css",self);  
      renderCSS(doc.css,"css",self);

      self.jsonEditor = new TextEditor('json-editor','text/javascript','json'+templateId);
      createCollection(doc.json,self);
      self.jsonEditor.setValue(doc.json);
      self.jsonEditor.debounce("change",saveJSON,templateId,userId);
      self.jsonEditor.on("change",renderJSON,"json",self); 
      renderHTML('',null,self);

    },

    changed : function(id,doc){

      // The Publication will only send change events where (this.userId!=doc.lastModifiedBy)
      // If someone else made this change, render the template, and update my editor.
      // If I made the last change, I won't recieve this change event.

      if(doc.css){
        renderCSS(doc.css,"css",self);
        self.cssEditor.setValue(doc.css);
        Session.set('UserEditMessage',{file:"css",user:doc.lastModifiedBy});
      }
      if(doc.html){
        renderHTML(doc.html,"html",self);
        self.htmlEditor.setValue(doc.html);
        Session.set('UserEditMessage',{file:"html",user:doc.lastModifiedBy});
      }
      if(doc.js){
        renderHTML(doc.js,"js",self);
        self.jsEditor.setValue(doc.js);
        Session.set('UserEditMessage',{file:"js",user:doc.lastModifiedBy});
      }
      if(doc.json){
        renderHTML("",null,self);  
        self.jsonEditor.setValue(doc.js);
        Session.set('UserEditMessage',{file:"json",user:doc.lastModifiedBy});
      }
    }
  });
}

// if someone tries to save an empty file = issue #20

var saveHTML = function(text,templateId,userId){
  Meteor.call('saveHTML',text,templateId,userId);
}

var saveJS = function(text,templateId,userId){
  Meteor.call('saveJS',text,templateId,userId);
}

var saveCSS = function(text,templateId,userId){
  Meteor.call('saveCSS',text,templateId,userId);
}

var saveJSON = function(text,templateId,userId){
  Meteor.call('saveJSON',text,templateId,userId); 
}


var createCollection = function(json,self){
  self.jsonError.set("ok");
  try{
    var items = JSON.parse(json);
    Data.remove({});
    if(items instanceof Array){
      _.each(items,function(item){
        Data.insert(item);
      });
    }else{
      throw new Error("JSON items must be in array.")
    }

  }catch(e){self.jsonError.set(e);}
  
}

/**
* renderJSON
* re-creates the local 'Data' Collection 
* calls render on the template
* @param {String} newJSON,  the json data to be inserted into the Data Collection
* @param {String} codeType , redundant, but consistent with the other render functions
* @param {Object} self , this Template.Editor instance
*/
var renderJSON = function(newJSON,codeType,self){
  createCollection(newJSON,self);
  renderHTML("",null,self); 
}


/**
* renderCSS
* applies CSS to the CSSOM, right now it will just continually append 
* and override everything on the page, TODO, scope CSS to a given container, or leave it?
* @param {String} newCSS,  css string
* @param {String} codeType , redundant, but consistent with the other render functions
* @param {Object} self , this Template.Editor instance
*/
var renderCSS = function(newCSS,codeType,self){

  destroyCSS();

  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');

  self.cssError.set("ok");

  style.type = 'text/css';
  if (style.styleSheet){
    style.styleSheet.cssText = _newCSS;
  } else {
    style.appendChild(document.createTextNode(newCSS));
  }

  head.appendChild(style);

}

var destroyCSS = function(){
  var head = document.head || document.getElementsByTagName('head')[0];
  var node = head.children[head.children.length-1];
  if(node.type==='text/css'){
    head.removeChild( node );  // assumes nothing else is appended to <head> between renders
                               // TODO : remove css by correct index or name, this has bad side effects
  }
}

var latestHTML = "";
var latestJS = "";
/**
* renderHTML
* renders html with a data context into the parent Dom object
* @param {String} codeType, either js or html
* @param {Object} self , this Template.Editor instance
*/
var renderHTML = function(text,codeType,self){

  if(self.htmlError){
    self.htmlError.set("ok");
  }

  if(codeType==="html"){
    latestHTML = text;
  }
  if(codeType==="js"){
    latestJS = text;
  }

  var parent = document.getElementById('htmlOutput');

  // going to 'try' it all, because we're auto-saving on each edit so
  // the malformed Blaze Template syntax will throw a lot of errors
  // which is good actually , we can output these errors to the user 
  try{
    
    var htmlJS = SpacebarsCompiler.compile(latestHTML);
    var evaled = eval(htmlJS);
    var view = Blaze.View(evaled);  // DL 3/2 removed Blaze.With(dataContext,evaled) template must fetch using helpers now

    parent.innerHTML = "";      // clear the output and re-render it
    
    var helpers = eval(latestJS);
    
    for(var key in helpers){
      Blaze.registerHelper(key, createHelper(helpers,key)); // uses Global helpers, 
                                                            // is it possible to apply helpers to the View instance?
    }

    self.renderedView =  Blaze.render(view,parent);

    self.renderedView._domrange.destroy();   // renders a view then destroys it every single time

    for(var key in helpers){
      delete Blaze._globalHelpers[key];  // clean up Global helpers after they're done
    }

  }catch(e){ 
    self.htmlError.set(e);
  }
}

// wraps each helper in a try / catch 
function createHelper(helpers,key){
  return function(args){ 
    try{
      return helpers[key](args);
    }catch(e){return e;} 
  }
}

