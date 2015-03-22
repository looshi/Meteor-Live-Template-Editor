
Router.configure({
  debug: true,
  layoutTemplate:'MainLayout'
});


Router.onBeforeAction(function () {
  if(this.ready()) {
    this.next()
  }else{
    this.render('LoadingTemplate');
  }
});

Router.route('TemplateList', {
  path:'/',     
});

Router.route('About', {
  path:'/about',     
});


Router.route('Editor', {
  path:'/:_id',     
  subscriptions: function() {
    var userId = Meteor.userId() ? Meteor.userId() + "" + Session.get('AnonymousUserId') : Session.get('AnonymousUserId');
    return Meteor.subscribe("singleTemplateData",this.params._id,userId);
  },
  data: function(){
    return CurrentTemplate.findOne(this.params._id);
  },
  action: function () {
    if (this.ready()) {
      this.render();
    } else {
      this.render('Loading');
    }
  }
});


var UserProfileController=RouteController.extend({
  template:"UserProfile",
  data: function(){
    return Meteor.users.findOne(this.params._id);
  },
  onBeforeAction:function(){
    if(this.data()){      
      this.next(); 
    }else{
      console.warn("user not found!!",this.params._id);
      Router.go('/');
    }
  }
});


Router.route('UserProfile', {
  path:'/user/:_id',
  controller:UserProfileController,
  action:function(){
    this.render('UserProfile');
  }     
});
