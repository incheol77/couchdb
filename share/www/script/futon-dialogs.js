// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

(function($) {
  
  $.futonSession = new (function () {
    
    function doLogin(name, password, callback) {
      $.couch.login({
        name : name,
        password : password,
        success : function() {
          $.futon.session.sidebar();
          callback();
        },
        error : function(code, error, reason) {
          $.futon.session.sidebar();
          callback({name : "Error logging in: "+reason});
        }
      });
    };
    
    function doSignup(name, password, callback, runLogin) {
      $.couch.signup({
        name : name
      }, password, {
        success : function() {
          if (runLogin) {
            doLogin(name, password, callback);            
          } else {
            callback();
          }
        },
        error : function(status, error, reason) {
          $.futon.session.sidebar();
          if (error == "conflict") {
            callback({name : "Name '"+name+"' is taken"});
          } else {
            callback({name : "Signup error:  "+reason});
          }
        }
      });
    };
    
    function validateUsernameAndPassword(data, callback) {
      if (!data.name || data.name.length == 0) {
        callback({name: "Please enter a name."});
        return false;
      };
      if (!data.password || data.password.length == 0) {
        callback({password: "Please enter a password."});
        return false;
      };
      return true;
    };
    
    function createAdmin() {
      $.showDialog("dialog/_create_admin.html", {
        submit: function(data, callback) {
          if (!validateUsernameAndPassword(data, callback)) return;
          $.couch.config({
            success : function() {
              doLogin(data.name, data.password, function(errors) {
                if(!$.isEmptyObject(errors)) {
                  callback(errors);
                  return;
                }
                doSignup(data.name, null, function(errors) {
                  if (errors && errors.name && errors.name.indexOf && errors.name.indexOf("taken") == -1) {
                    callback(errors);
                  } else {
                    callback();
                  }
                  }, false);
                });            
            }
          }, "admins", data.name, data.password);
        }
      });
      return false;
    };

    function login() {
      $.showDialog("dialog/_login.html", {
        submit: function(data, callback) {
          if (!validateUsernameAndPassword(data, callback)) return;
          doLogin(data.name, data.password, callback);
        }
      });
      return false;
    };

    function logout() {
      $.couch.logout({
        success : function(resp) {
          $.futon.session.sidebar();
        }
      })
    };

    function signup() {
      $.showDialog("dialog/_signup.html", {
        submit: function(data, callback) {
          if (!validateUsernameAndPassword(data, callback)) return;
          doSignup(data.name, data.password, callback, true);
        }
      });
      return false;
    };

    this.setupSidebar = function() {
      $("#userCtx .login").click(login);
      $("#userCtx .logout").click(logout);
      $("#userCtx .signup").click(signup);
      $("#userCtx .createadmin").click(createAdmin);
    };
    
    this.sidebar = function() {
      // get users db info?
      $("#userCtx span").hide();
      $.couch.session({
        success : function(r) {
          var userCtx = r.userCtx;
          $$("#userCtx").userCtx = userCtx;
          if (userCtx.name) {
            $("#userCtx .name").text(userCtx.name).attr({href : $.couch.urlPrefix + "/_utils/document.html?"+encodeURIComponent(r.info.authentication_db)+"/org.couchdb.user%3A"+encodeURIComponent(userCtx.name)});
            if (userCtx.roles.indexOf("_admin") != -1) {
              $("#userCtx .loggedinadmin").show();
            } else {
              $("#userCtx .loggedin").show();
            }
          } else if (userCtx.roles.indexOf("_admin") != -1) {
            $("#userCtx .adminparty").show();
          } else {
            $("#userCtx .loggedout").show();
          };
        }
      })
    };
  })()
  

  $.fn.centerBox = function() {
    return this.each(function() {
      var s = this.style;
      s.left = (($(window).width() - $(this).width()) / 2) + "px";
      s.top = (($(window).height() - $(this).height()) / 2) + "px";
    });
  }

  $.showDialog = function(url, options) {
    options = options || {};
    options.load = options.load || function() {};
    options.cancel = options.cancel || function() {};
    options.validate = options.validate || function() { return true };
    options.submit = options.submit || function() {};

    var overlay = $('<div id="overlay" style="z-index:1001"></div>')
      .css("opacity", "0");
    var dialog = $('<div id="dialog" style="z-index:1002;position:fixed;display:none;"></div>');
    if ($.browser.msie) {
      var frame = $('<iframe id="overlay-frame" style="z-index:1000;border:none;margin:0;padding:0;position:absolute;width:100%;height:100%;top:0;left:0" src="javascript:false"></iframe>')
        .css("opacity", "0").appendTo(document.body);
      if (parseInt($.browser.version)<7) {
        dialog.css("position", "absolute");
        overlay.css("position", "absolute");
        $("html,body").css({width: "100%", height: "100%"});
      }
    }
    overlay.appendTo(document.body).fadeTo(100, 0.6);
    dialog.appendTo(document.body).centerBox().fadeIn(400);

    $(document).keydown(function(e) {
      if (e.keyCode == 27) dismiss(); // dismiss on escape key
    });
    function dismiss() {
      dialog.fadeOut("fast", function() {
        $("#dialog, #overlay, #overlay-frame").remove();
      });
      $(document).unbind("keydown");
    }
    overlay.click(function() { dismiss(); });

    function showError(name, message) {
      var input = dialog.find(":input[name=" + name + "]");
      input.addClass("error").next("div.error").remove();
      $('<div class="error"></div>').text(message).insertAfter(input);
    }

    $.get(url, function(html) {
      $(html).appendTo(dialog);
      dialog.centerBox().each(function() {
        options.load(dialog.children()[0]);
        $(":input:first", dialog).each(function() { this.focus() });
        $("button.cancel", dialog).click(function() { // dismiss on cancel
          dismiss();
          options.cancel();
        });
        $("form", dialog).submit(function(e) { // invoke callback on submit
          e.preventDefault();
          dialog.find("div.error").remove().end().find(".error").removeClass("error");
          var data = {};
          $.each($("form :input", dialog).serializeArray(), function(i, field) {
            data[field.name] = field.value;
          });
          $("form :file", dialog).each(function() {
            data[this.name] = this.value; // file inputs need special handling
          });
          options.submit(data, function callback(errors) {
            if ($.isEmptyObject(errors)) {
              dismiss();
            } else {
              for (var name in errors) {
                showError(name, errors[name]);
              }
            }
          });
          return false;
        });
      });
    });
  }
  
  $.futonDialogs = {
    createDatabase : function() {
      $.showDialog("dialog/_create_database.html", {
        submit: function(data, callback) {
          if (!data.name || data.name.length == 0) {
            callback({name: "Please enter a name."});
            return;
          }
          $.couch.db(data.name).create({
            error: function(status, id, reason) { callback({name: reason}) },
            success: function(resp) {
              location.hash = "#/" + encodeURIComponent(data.name);
              callback();
            }
          });
        }
      });
      return false;
    }
    
    , deleteDatabase : function(dbName) {
      $.showDialog("dialog/_delete_database.html", {
        submit: function(data, callback) {
          $.couch.db(dbName).drop({
            success: function(resp) {
              callback();
              location.href = "index.html";
              if (window !== null) {
                $("#dbs li").filter(function(index) {
                  return $("a", this).text() == dbName;
                }).remove();
                // $.futon.navigation.removeDatabase(dbName);
              }
            }
          });
        }
      });
    }
    
    , compactAndCleanup : function(dbName) {
      var db = $.couch.db(dbName);
      $.showDialog("dialog/_compact_cleanup.html", {
        submit: function(data, callback) {
          switch (data.action) {
            case "compact_database":
              db.compact({success: function(resp) { callback() }});
              break;
            case "compact_views":
              var groupname = page.viewName.substring(8,
                  page.viewName.indexOf("/_view"));
              db.compactView(groupname, {success: function(resp) { callback() }});
              break;
            case "view_cleanup":
              db.viewCleanup({success: function(resp) { callback() }});
              break;
          }
        }
      });
    }
  }
  
  $.futonSession = new (function Session() {
    
    function doLogin(name, password, callback) {
      $.couch.login({
        name : name,
        password : password,
        success : function() {
          $.futon.session.sidebar();
          callback();
        },
        error : function(code, error, reason) {
          $.futon.session.sidebar();
          callback({name : "Error logging in: "+reason});
        }
      });
    };
    
    function doSignup(name, password, callback, runLogin) {
      $.couch.signup({
        name : name
      }, password, {
        success : function() {
          if (runLogin) {
            doLogin(name, password, callback);            
          } else {
            callback();
          }
        },
        error : function(status, error, reason) {
          $.futon.session.sidebar();
          if (error == "conflict") {
            callback({name : "Name '"+name+"' is taken"});
          } else {
            callback({name : "Signup error:  "+reason});
          }
        }
      });
    };
    
    function validateUsernameAndPassword(data, callback) {
      if (!data.name || data.name.length == 0) {
        callback({name: "Please enter a name."});
        return false;
      };
      if (!data.password || data.password.length == 0) {
        callback({password: "Please enter a password."});
        return false;
      };
      return true;
    };
    
    function createAdmin() {
      $.showDialog("dialog/_create_admin.html", {
        submit: function(data, callback) {
          if (!validateUsernameAndPassword(data, callback)) return;
          $.couch.config({
            success : function() {
              doLogin(data.name, data.password, function(errors) {
                if(!$.isEmptyObject(errors)) {
                  callback(errors);
                  return;
                }
                doSignup(data.name, null, function(errors) {
                  if (errors && errors.name && errors.name.indexOf && errors.name.indexOf("taken") == -1) {
                    callback(errors);
                  } else {
                    callback();
                  }
                  }, false);
                });            
            }
          }, "admins", data.name, data.password);
        }
      });
      return false;
    };

    function login() {
      $.showDialog("dialog/_login.html", {
        submit: function(data, callback) {
          if (!validateUsernameAndPassword(data, callback)) return;
          doLogin(data.name, data.password, callback);
        }
      });
      return false;
    };

    function logout() {
      $.couch.logout({
        success : function(resp) {
          $.futon.session.sidebar();
        }
      })
    };

    function signup() {
      $.showDialog("dialog/_signup.html", {
        submit: function(data, callback) {
          if (!validateUsernameAndPassword(data, callback)) return;
          doSignup(data.name, data.password, callback, true);
        }
      });
      return false;
    };

    this.setupSidebar = function() {
      $("#userCtx .login").click(login);
      $("#userCtx .logout").click(logout);
      $("#userCtx .signup").click(signup);
      $("#userCtx .createadmin").click(createAdmin);
    };
    
    this.sidebar = function() {
      // get users db info?
      $("#userCtx span").hide();
      $.couch.session({
        success : function(r) {
          var userCtx = r.userCtx;
          $("#userCtx").userCtx = userCtx;
          if (userCtx.name) {
            $("#userCtx .name").text(userCtx.name).attr({href : $.couch.urlPrefix + "/_utils/document.html?"+encodeURIComponent(r.info.authentication_db)+"/org.couchdb.user%3A"+encodeURIComponent(userCtx.name)});
            if (userCtx.roles.indexOf("_admin") != -1) {
              $("#userCtx .loggedinadmin").show();
            } else {
              $("#userCtx .loggedin").show();
            }
          } else if (userCtx.roles.indexOf("_admin") != -1) {
            $("#userCtx .adminparty").show();
          } else {
            $("#userCtx .loggedout").show();
          };
        }
      })
    };
  })();
  
})(jQuery);

// Also add pretty JSON

(function($) {
  var _escape = function(string) {
    return string.replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;");
  };

  // JSON pretty printing
  $.formatJSON = function (val, options) {
    options = $.extend({
      escapeStrings: true,
      indent: 4,
      linesep: "\n",
      quoteKeys: true
    }, options || {});
    var itemsep = options.linesep.length ? "," + options.linesep : ", ";

    function format(val, depth) {
      var tab = [];
      for (var i = 0; i < options.indent * depth; i++) tab.push("");
      tab = tab.join(" ");

      var type = typeof val;
      switch (type) {
        case "boolean":
        case "number":
        case "string":
          var retval = val;
          if (type == "string" && !options.escapeStrings) {
            retval = indentLines(retval.replace(/\r\n/g, "\n"), tab.substr(options.indent));
          } else {
            if (options.html) {
              retval = escape(JSON.stringify(val));
            } else {
              retval = JSON.stringify(val);
            }
          }
          if (options.html) {
            retval = "<code class='" + type + "'>" + retval + "</code>";
          }
          return retval;

        case "object": {
          if (val === null) {
            if (options.html) {
              return "<code class='null'>null</code>";
            }
            return "null";
          }
          if (val.constructor == Date) {
            return JSON.stringify(val);
          }

          var buf = [];

          if (val.constructor == Array) {
            buf.push("[");
            for (var index = 0; index < val.length; index++) {
              buf.push(index > 0 ? itemsep : options.linesep);
              buf.push(tab, format(val[index], depth + 1));
            }
            if (index >= 0) {
              buf.push(options.linesep, tab.substr(options.indent));
            }
            buf.push("]");
            if (options.html) {
              return "<code class='array'>" + buf.join("") + "</code>";
            }

          } else {
            buf.push("{");
            var index = 0;
            for (var key in val) {
              buf.push(index > 0 ? itemsep : options.linesep);
              var keyDisplay = options.quoteKeys ? JSON.stringify(key) : key;
              if (options.html) {
                if (options.quoteKeys) {
                  keyDisplay = keyDisplay.substr(1, keyDisplay.length - 2);
                }
                keyDisplay = "<code class='key'>" + _escape(keyDisplay) + "</code>";
                if (options.quoteKeys) {
                  keyDisplay = '"' + keyDisplay + '"';
                }
              }
              buf.push(tab, keyDisplay,
                ": ", format(val[key], depth + 1));
              index++;
            }
            if (index >= 0) {
              buf.push(options.linesep, tab.substr(options.indent));
            }
            buf.push("}");
            if (options.html) {
              return "<code class='object'>" + buf.join("") + "</code>";
            }
          }

          return buf.join("");
        }
      }
    }

    function indentLines(text, tab) {
      var lines = text.split("\n");
      for (var i in lines) {
        lines[i] = (i > 0 ? tab : "") + _escape(lines[i]);
      }
      return lines.join("<br>");
    }

    return format(val, 1);
  };

  // File size pretty printing
  var formatSize = function(size) {
    var jump = 512;
    if (size < jump) return size + " bytes";
    var units = ["KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    var i = 0;
    while (size >= jump && i < units.length) {
      i += 1;
      size /= 1024
    }
    return size.toFixed(1) + ' ' + units[i - 1];
  }
})(jQuery);

// Add resizer

// This code is needed for toggling the sidebar.

// (function($) {
// 
//   $.fn.makeResizable = function(options) {
//     options = options || {};
//     options.always = options.always || false;
//     options.grippie = options.grippie || null;
//     options.horizontal = options.horizontal || false;
//     options.minWidth = options.minWidth || 100;
//     options.maxWidth = options.maxWidth || null;
//     options.vertical = options.vertical || false;
//     options.minHeight = options.minHeight || 32;
//     options.maxHeight = options.maxHeight || null;
// 
//     return this.each(function() {
//       if ($(this).is("textarea") && !options.always &&
//           $.browser.safari && parseInt($.browser.version) >= 522)
//         return this; // safari3 and later provides textarea resizing natively
// 
//       var grippie = options.grippie;
//       if (!grippie) grippie = $("<div></div>").appendTo(this.parentNode);
//       grippie.addClass("grippie");
//       if (options.horizontal && options.vertical) {
//         grippie.css("cursor", "nwse-resize");
//       } else if (options.horizontal) {
//         grippie.css("cursor", "col-resize");
//       } else if (options.vertical) {
//         grippie.css("cursor", "row-resize");
//       }
// 
//       var elem = $(this);
//       grippie.mousedown(function(e) {
//         var pos = {x: e.screenX, y: e.screenY};
//         var dimensions = {width: elem.width(), height: elem.height()};
//         $(document)
//           .mousemove(function(e) {
//             if (options.horizontal) {
//               var offset = e.screenX - pos.x;
//               if (offset) {
//                 var newWidth = dimensions.width + offset;
//                 if (newWidth >= options.minWidth &&
//                     (!options.maxWidth || newWidth <= options.maxWidth)) {
//                   elem.width(newWidth);
//                   dimensions.width = newWidth;
//                 }
//                 pos.x = e.screenX;
//               }
//             }
//             if (options.vertical) {
//               var offset = e.screenY - pos.y;
//               if (offset) {
//                 var newHeight = dimensions.height + offset;
//                 if (newHeight >= options.minHeight &&
//                     (!options.maxHeight || newHeight <= options.maxHeight)) {
//                   elem.height(newHeight);
//                   dimensions.height = newHeight;
//                 }
//                 pos.y = e.screenY;
//               }
//             }
//             document.onselectstart = function() { return false }; // for IE
//             return false;
//           })
//           .one("mouseup", function() {
//             $(document).unbind("mousemove");
//             document.onselectstart = null; // for IE
//           });
//         return true;
//       });
//     });
//   }
// 
// })(jQuery);
