(function() {
    'use strict';
    
    var DIR         = __dirname + '/../../',
        DIR_HTML    = DIR       + 'html/',
        DIR_LIB     = DIR       + 'lib/',
        DIR_SERVER  = __dirname + '/',
        DIR_FS      = DIR_HTML  + 'fs/',
        
        fs          = require('fs'),
        
        main        = require(DIR_SERVER + 'main'),
        mellow      = require(DIR_SERVER + 'mellow'),
        ponse       = require(DIR_SERVER + 'ponse'),
        files       = require(DIR_SERVER + 'files'),
        minify      = require(DIR_SERVER + 'minify'),
        
        Util        = require(DIR_LIB + 'util'),
        CloudFunc   = require(DIR_LIB + 'cloudfunc'),
        format      = require(DIR_LIB + 'format'),
        
        Config      = main.config,
        
        PATH_INDEX  = DIR_FS   + 'index.html',
        
        TMPL_PATH   = [
            'file',
            'panel',
            'path',
            'pathLink',
            'link',
        ],
        
        Template    = {},
        
        FS          = CloudFunc.FS;
    
    module.exports  = route;
    
    readFiles();
    
    /**
     * additional processing of index file
     */
    function indexProcessing(options) {
        var keysPanel, left, right,
            LEFT    = CloudFunc.PANEL_LEFT,
            RIGHT   = CloudFunc.PANEL_RIGHT,
            data    = options.data,
            panel   = options.panel;
        
        if (!Config.showKeysPanel) {
            keysPanel  = '<div class="keyspanel';
            data        = data.replace(keysPanel + '"', keysPanel +' hidden"');
        }
        
        left    = Util.render(Template.panel, {
            id      : LEFT,
            side    : 'left',
            content : panel
        });
        
        right    = Util.render(Template.panel, {
            id      : RIGHT,
            side    : 'right',
            content : panel
        });
        
        data = Util.render(data, {
            title   : CloudFunc.getTitle(),
            fm      : left + right
        });
        
        return data;
    }
    
    function readFiles(callback) {
        var filesList, paths   = {};
        
        filesList   = TMPL_PATH.map(function(name) {
            var path = DIR_FS + name + '.html';
            
            paths[path] = name;
            
            return path;
        });
        
        files.read(filesList, 'utf8', function(error, files) {
            var status, msg, names;
            
            if (error) {
                Util.log(error);
            } else {
                status          = 'ok';
                
                Object.keys(files).forEach(function(path) {
                    var name = paths[path];
                    
                    Template[name] = files[path];
                });
                
                names           = TMPL_PATH.map(function(item) {
                    return item + '.html';
                });
                
                msg = CloudFunc.formatMsg('read', names, status);
                Util.log(msg);
            }
        });
    }
    
    /**
     * routing of server queries
     */
    function route(request, response, callback) {
        var name, p, isAuth, isFS, path;
        
        if (request && response) {
            name    = ponse.getPathName(request);
            isAuth  = Util.strCmp(name, ['/auth', '/auth/github']);
            isFS    = Util.strCmp(name, '/') || Util.isContainStrAtBegin(name, FS);
            
            p       = {
                request     : request,
                response    : response,
                gzip        : true,
                name        : name
            };
            
            if (!isAuth && !isFS)
                Util.exec(callback);
            else if (isAuth) {
                Util.log('* Routing' + '-> ' + name);
                
                p.name = DIR_HTML + name + '.html';
                ponse.sendFile(p);
            } else if (isFS) {
                name    = Util.rmStrOnce(name, CloudFunc.FS) || main.SLASH;
                path    = mellow.convertPath(name);
                
                mellow.read(path, function(error, dir) {
                    if (dir)
                        dir.path = format.addSlashToEnd(name);
                    
                    if (error)
                        if (error.code !== 'ENOTDIR')
                            ponse.sendError(error, p);
                        else
                            fs.realpath(path, function(error, pathReal) {
                                if (!error)
                                    p.name = pathReal;
                                else
                                    p.name = path;
                                
                                p.gzip = false;
                                ponse.sendFile(p);
                            });
                    else
                        buildIndex(dir, function(error, data) {
                            var NOT_LOG = true;
                            
                            p.name = PATH_INDEX;
                            
                            if (error)
                                ponse.sendError(error, p);
                            else
                                ponse.send(data, p, NOT_LOG);
                        });
                });
            }
        }
    }
    
    function buildIndex(json, callback) {
        var isMinify = Config.minify;
        
        Util.exec.if(!isMinify, function(error, name) {
            fs.readFile(name || PATH_INDEX, 'utf8', function(error, template) {
                var panel, data;
                
                if (!error) {
                    panel   = CloudFunc.buildFromJSON({
                        data        : json,
                        template    : Template
                    }),
                    
                    data    = indexProcessing({
                        panel   : panel,
                        data    : template,
                    });
                }
                
                Util.exec(callback, error, data);
            });
        },  function(callback) {
                minify(PATH_INDEX, {
                    log         : true,
                    returnName  : true
                }, callback);
        });
    }
})();