(function(root, library) {
    if (typeof define === 'function' && define.amd) {
        define('generic-tree', [], library);
    } else {
        root.GenericTree = library();
    }
})(this, function() {
    function GenericTree() {
        this.root = null;

        this.insert = function(key, parent, properties) {
            if (key === undefined) {
                throw new Error('Missing argument: key');
            }
            parent = parent instanceof Node ? [parent] : this.search(parent);
            var node = new Node(key, properties);
            if (parent === null && !this.root) {
                this.root = node;
            } else if (parent === null && !!this.root) {
                throw new Error('GenericTree already has a root. Please specify the node\'s parent.');
            } else if (!parent.length) {
                throw new Error('Parent node not found.');
            } else {
                parent[0].insert(node);
            }
            return node;
        };

        this.delete = function(node) {
            if (node === undefined) {
                throw new Error('Missing argument: key');
            }
            var targets = node instanceof Node ? [node] : this.search(node);
            if (targets === null || !targets.length) {
                throw new Error('Target node not found.');
            }
            for (var i = 0; i < targets.length; i++) {
                var target = targets[i];
                if (target === this.root) {
                    this.root = null;
                } else {
                    target.parent.delete(target);
                }
            }
        };

        this.search = function(key) {
            return key !== undefined && this.root ? this.root.search(key) : null;
        };

        this.traverse = function() {
            if (this.root !== null) {
                var queue = [this.root];
                var levels = [];
                var level = [];
                for (var i = 1, j = 0; queue.length;) {
                    var pointer = queue.shift();
                    level.push(pointer);
                    j += pointer.children.length;
                    if (!--i) {
                        i = j;
                        j = 0;
                        levels.push(level);
                        level = [];
                    }
                    queue = queue.concat(pointer.children);
                }
                return levels;
            }
            return [];
        };
    }

    function Node(key, properties) {
        this.key = key;
        this.parent = null;
        this.children = [];

        properties = properties && typeof properties === 'object' ? properties : {};
        for (var i in properties) {
            this[i] = properties[i];
        }

        this.insert = function(child) {
            this.children.push(child);
            child.parent = this;
        };

        this.delete = function(child) {
            this.children.splice(this.children.indexOf(child), 1);
        };

        this.search = function(key) {
            var results = this.key.match('^' + key.replace(/\./g, '\\.').replace(/\*/g, '\.\*') + '$') ? [this] : [];
            for (var i in this.children) {
                results = results.concat(this.children[i].search(key));
            }
            return results;
        };

        this.find = function(key) {
            var results = [];
            for (var i in this.children) {
                if (this.children[i].key.match('^' + key.replace(/\./g, '\\.').replace(/\*/g, '\.\*') + '$')) {
                    results.push(this.children[i]);
                }
            }
            return results;
        };
    }

    return GenericTree;
});

(function(root, library) {
    if (typeof define === 'function' && define.amd) {
        define('virtual-filesystem', ['generic-tree'], library);
    } else {
        root.VirtualFileSystem = library(root.GenericTree);
    }
})(this, function(GenericTree) {
    function VirtualFileSystem() {
        this.tree = new GenericTree();
        this.tree.insert('', null, { type: 'directory' });
        this.pointer = this.tree.root;

        this.mkdir = function(path) {
            if (path === undefined) {
                throw new Error('Missing argument: path');
            }
            var segments = path.replace(/\/+$/g, '').split('/');
            var parent = this._resolve_path(segments.slice(0, segments.length - 1).join('/'));
            var name = segments[segments.length - 1];
            if (parent.find(name).length) {
                throw new Error('Name already taken: ' + name);
            }
            this.tree.insert(name, parent, { type: 'directory' });
        };

        this.rmdir = function(path) {
            if (path === undefined) {
                throw new Error('Missing argument: path');
            }
            var node = this._resolve_path(path.replace(/\/+$/g, ''));
            if (node === this.tree.root) {
                throw new Error('You cannot delete the root directory.');
            } else if (node.type !== 'directory') {
                throw new Error('Not a directory: ' + node.key);
            }
            this.tree.delete(node);
            var current_path = this._absolute_path(this.pointer);
            var node_path = this._absolute_path(node);
            if (node_path.match('^' + current_path) && current_path.length) {
                this.pointer = node.parent;
            }
        };

        this.cd = function(path) {
            if (path === undefined) {
                throw new Error('Missing argument: path');
            }
            this.pointer = this._resolve_path(path);
            return this.pointer;
        };

        this.cat = function(mode, path, contents) {
            if (path === undefined) {
                throw new Error('Missing argument: path');
            }
            var segments = path.replace(/\/+$/g, '').split('/');
            var parent = this._resolve_path(segments.slice(0, segments.length - 1).join('/'));
            var name = segments[segments.length - 1];
            var node = parent.find(name)[0];
            if (node && node.type !== 'file') {
                throw new Error('Not a file: ' + path);
            } else if (mode.length) {
                if (node === undefined) {
                    node = this.tree.insert(name, parent, { type: 'file', contents: '' });
                }
                node.contents = mode === '>' ? contents : node.contents + contents;
            } else {
                if (node === undefined) {
                    throw new Error('File not found: ' + path);
                }
                return node.contents;
            }
        };

        this.rm = function(path) {
            if (path === undefined) {
                throw new Error('Missing argument: path');
            }
            var node = this._resolve_path(path.replace(/\/+$/g, ''));
            if (node.type !== 'file') {
                throw new Error('Not a file: ' + node.key);
            }
            this.tree.delete(node);
        };

        this.rn = function(path, name) {
            if (path === undefined) {
                throw new Error('Missing argument: path');
            } else if (name === undefined) {
                throw new Error('Missing argument: name');
            }
            var node = this._resolve_path(path);
            if (node === this.tree.root) {
                throw new Error('You cannot rename the root directory.');
            }
            var search = node.parent.find(name)[0];
            if (search && search.type === node.type) {
                throw new Error('Rename failed. Name already taken.');
            }
            node.key = name;
        };

        this.cp = function(target, destination) {
            if (target === undefined) {
                throw new Error('Missing argument: target');
            } else if (destination === undefined) {
                throw new Error('Missing argument: destination');
            }
            target = typeof target === 'object' ? target : this._resolve_path(target);
            destination = typeof destination === 'object' ? destination : this._resolve_path(destination);
            var properties = { type: target.type };
            if (properties.type === 'file') {
                properties.contents = target.contents;
            }
            var node = this.tree.insert(target.key, destination, properties);
            for (var i = 0; i < target.children.length; i++) {
                this.cp(target.children[i], node);
            }
            return node;
        };

        this.mv = function(target, destination) {
            if (target === undefined) {
                throw new Error('Missing argument: target');
            } else if (destination === undefined) {
                throw new Error('Missing argument: destination');
            }
            target = typeof target === 'object' ? target : this._resolve_path(target);
            destination = typeof destination === 'object' ? destination : this._resolve_path(destination);
            this.tree.delete(target);
            return this.cp.call(this, target, destination);
        };

        this.ls = function(path) {
            var node = path === undefined ? this.pointer : this._resolve_path(path);
            if (node.type === 'directory') {
                return node.children;
            }
            throw new Error('Not a directory: ' + path);
        };

        this.whereis = function(query) {
            if (query === undefined) {
                throw new Error('Missing argument: query');
            }
            return this.tree.search(query);
        };

        this._resolve_path = function(path) {
            path = path.match('^\/') ? path : './' + path;
            path = path.split('/');
            var parent = path[0].length ? this.pointer : this.tree.root;
            for (var i = !path[0].length ? 1 : 0; i < path.length; i++) {
                if (path[i] === '..') {
                    if (parent === this.tree.root) {
                        throw new Error('No more directories beyond root directory.');
                    }
                    parent = parent.parent;
                } else if (path[i] !== '.' && path[i].length) {
                    parent = parent.find(path[i])[0];
                    if (parent === undefined) {
                        throw new Error('Path not found: ' + path.slice(0, i + 1).join('/'));
                    }
                }
            }
            return parent;
        };

        this._absolute_path = function(node) {
            var path = [];
            while (node !== null) {
                path.unshift(node.key);
                node = node.parent;
            }
            return path.join('/');
        };
    }

    return VirtualFileSystem;
});

$(document).ready(function() {
    filesystem.initialize();
    components.initialize();
    windows.initialize();
    system.initialize();
});

var filesystem = {
    instance: new VirtualFileSystem(),
    initialize: function() {
        filesystem.instance.mkdir('years');
        filesystem.instance.mkdir('months');
        filesystem.instance.mkdir('seasons');
        filesystem.instance.mkdir('weeks');
        filesystem.instance.mkdir('years/2023');
        filesystem.instance.mkdir('years/atelier');
        filesystem.instance.mkdir('years/A');
        filesystem.instance.mkdir('years/seasons');
        filesystem.instance.mkdir('years/2023/cmsc142');
        filesystem.instance.mkdir('years/2023/cmsc141');
        filesystem.instance.mkdir('years/2023/sts40');
        filesystem.instance.mkdir('years/2023/cmsc198.1');
        filesystem.instance.mkdir('years/seasons/txt');
        filesystem.instance.mkdir('years/seasons/images');
        filesystem.instance.mkdir('years/seasons/sounds');
        filesystem.instance.mkdir('years/seasons/cmsc142');
        filesystem.instance.mkdir('years/seasons/cmsc141');
        filesystem.instance.mkdir('months/2023');
        filesystem.instance.mkdir('months/2023/september');
        filesystem.instance.mkdir('seasons/2023');
        filesystem.instance.mkdir('seasons/2023/autumn');
        filesystem.instance.mkdir('weeks/2023');
        filesystem.instance.mkdir('weeks/2023/36th');
        filesystem.instance.mkdir('weeks/2023/36th/aw23');
        filesystem.instance.mkdir('weeks/2023/36th/aw23/september');
        filesystem.instance.mkdir('weeks/2023/36th/aw23/september/fourth');
        filesystem.instance.mkdir('weeks/2023/36th/aw23/september/fifth');
        filesystem.instance.mkdir('weeks/2023/36th/aw23/september/fourth/11thhour');
        filesystem.instance.mkdir('weeks/2023/36th/aw23/september/fourth/11thhour/59thminute');
        filesystem.instance.mkdir('weeks/2023/36th/aw23/september/fourth/11thhour/59thminute/59thsecond');
        filesystem.instance.mkdir('weeks/2023/36th/aw23/september/fourth/11thhour/59thminute/59thsecond/secondlastmilisecond');
        filesystem.instance.mkdir('weeks/2023/36th/aw23/september/fourth/11thhour/59thminute/59thsecond/secondlastmilisecond/this_moment_is_eternal');


       


        
        filesystem.instance.cat('>', 'weeks/2023/36th/aw23/september/fourth/11thhour/59thminute/59thsecond/secondlastmilisecond/this_moment_is_eternal/rootfile.txt', 'potemkinantonym.github.io is now live');
        filesystem.instance.cat('>', 'years/seasons/cmsc141/autumnwinter.txt', 'AW23 teaser \n https://9db8-24aec26c7663-staging.phoebephilo.com/media/wysiwyg/homepage/Image.png?');
        filesystem.instance.cat('>', 'years/seasons/cmsc142/audio.txt', 'AW23 Soundtrack \n \n https://soundcloud.com/ssssonic/celine-ss-2016-rtw-paris');
        filesystem.instance.cat('>', 'years/2023/cmsc142/autumnwinter.txt', 'AW23 teaser \n https://9db8-24aec26c7663-staging.phoebephilo.com/media/wysiwyg/homepage/Image.png?');
        filesystem.instance.cat('>', 'years/2023/cmsc142/audio.txt', 'AW23 Soundtrack \n \n https://soundcloud.com/ssssonic/celine-ss-2016-rtw-paris');
        filesystem.instance.cat('>', 'years/seasons/txt/colour.txt', 'AW23 Colour pallet \n [{"name":"Raisin black","hex":"30292f","rgb":[48,41,47],"cmyk":[0,15,2,81],"hsb":[309,15,19],"hsl":[309,8,17],"lab":[18,5,-3]},\n{"name":"English Violet","hex":"413f54","rgb":[65,63,84],"cmyk":[23,25,0,67],"hsb":[246,25,33],"hsl":[246,14,29],"lab":[28,6,-12]},{"name":"Ultra Violet","hex":"5f5aa2","rgb":[95,90,162],"cmyk":[41,44,0,36],"hsb":[244,44,64],"hsl":[244,29,49],"lab":[42,21,-38]},{"name":"YInMn Blue","hex":"355691","rgb":[53,86,145],"cmyk":[63,41,0,43],"hsb":[218,63,57],"hsl":[218,46,39],"lab":[37,8,-36]},\n{"name":"Onyx","hex":"3f4045","rgb":[63,64,69],"cmyk":[9,7,0,73],"hsb":[230,9,27],"hsl":[230,5,26],"lab":[27,1,-3]}]');
        filesystem.instance.cat('>', 'years/seasons/txt/studiodeliverooorder.txt', 'Olives	4.80 \n Celeriac Soup	11.00\n Beetroot, Red Cabbage, Chervil and Creme Fraiche	11.20 \n Lambs Liver Terrine	13.00 \n Smoked Eel and Aioli	14.00 \n Beef Rissole, Radishes and Horseradish	13.50 \n Pickled Mackerel, Potato and Spinach	13.00 \nPotted Pork	12.50 \n Whole Crab and Mayonnaise	24.00\n Roast Kid, Carrots and Mint	32.00');
        filesystem.instance.cat('>', 'years/seasons/images/inscribe.txt', 'I went to San Francisco\n because I had not been able to work        \n in some months.\n Id been paralyzed by the conviction \n that writing was an irrelevant act... \n that the world as I had understood it\n no longer existed.\n It was the first time\n  Id dealt directly and flatly\n with the evidence of atomization,\n the proof that things fall apart.\n If I was to work again,\n it would be necessary for me\n to come to terms with disorder.\n When snakes would appear\n so much in your...');
        filesystem.instance.cat('>', 'years/seasons/sounds/annoucement.txt', 'Our inaugural collection will be revealed and available on our website, phoebephilo.com, in September 2023. We will be opening for registration in July 2023 and look forward to being back in touch then.');

        Window.favorites = ['/years', '/months', '/seasons', 'weeks'];
    },
    resolve_path: function(path) {
        return path === undefined ? filesystem.instance.tree.root : filesystem.instance._resolve_path(path);
    },
    absolute_path: function(path) {
        return this.instance._absolute_path(path);
    }
};

var components = {
    initialize: function() {
        components.icons();
        components.textareas();
        components.huds();
    },
    icons: function() {
        windows.desktop.on('mousedown', '.icon', function(e) {
            if (e.ctrlKey) {
                $(this).toggleClass('highlighted');
            } else {
                $('.icon').removeClass('highlighted');
                $(this).addClass('highlighted');
            }
            var target = $(this).closest('.window');
            if (target.length) {
                windows.focus(windows.instance(target));
            }
        });

        windows.desktop.on('dblclick', '.icon[data-application]', function(e) {
            $(this).removeClass('highlighted');
            windows.spawn($(this).data('application'));
        });

        windows.desktop.on('dblclick', '.window .icon', function(e) {
            $(this).removeClass('highlighted');
            var target = windows.instance($(this).closest('.window'));
            target.icons_handler(e);
        });

        windows.desktop.on('mousedown', function(e) {
            if (!$(e.target).hasClass('icon')) {
                $('.icon').removeClass('highlighted');
            }
            if (!$(e.target).closest('.contextmenu').length) {
                $('.contextmenu').addClass('hidden');
            }
        });
    },
    textareas: function() {
        windows.desktop.on('keydown', 'textarea', function(e) {
            var target = windows.instance($(this).closest('.window'));
            if (e.keyCode === 9) {
                e.preventDefault();
            } else if (e.keyCode === 13 && $(this).attr('data-capture-enter') === 'true') {
                e.preventDefault();
                target.textarea_handler(e);
            } else if (e.ctrlKey && (e.keyCode === 76 || e.keyCode === 68 || e.keyCode === 83)) {
                e.preventDefault();
                target.keyboard_handler(e);
            } else if (e.keyCode === 27) {
                target.keyboard_handler(e);
            } else if ($(this).hasClass('autosize')) {
                target.textarea_handler(e);
            }
        });

        windows.desktop.on('blur', '.window .icon textarea', function(e) {
            var target = windows.instance($(this).closest('.window'));
            target.textarea_handler(e);
        });
    },
    huds: function() {
        windows.desktop.on('mousedown', '.window .action-button', function(e) {
            $('.icon').removeClass('highlighted');
            var target = windows.instance($(this).closest('.window'));
            target.huds_handler(e);
        });

        windows.desktop.on('focus', '.window input', function(e) {
            $(this).attr('data-value', $(this).val());
        });

        windows.desktop.on('keydown', '.window input', function(e) {
            $(this).removeClass('error');
            if (e.keyCode === 27) {
                $(this).val($(this).data('value')).trigger('blur');
            } else if (e.keyCode === 13) {
                $(this).trigger('blur');
                var target = windows.instance($(this).closest('.window'));
                target.huds_handler(e);
            }
        });

        windows.desktop.on('mousedown', function(e) {
            $('.window input').removeClass('error');
        });
    }
};

var windows = {
    desktop: $('#desktop'),
    instances: {},
    initialize: function() {
        windows.focus();
        windows.draggable();
        windows.actions();

        // transfer this later
        windows.desktop.on('click', '.favorites li', function(e) {
            var target = windows.instance($(this).closest('.window'));
            var node = filesystem.resolve_path($(this).data('path'));
            target.location(node);
        });
    },
    spawn: function(application, path) {
        application = applications[application](path);
        var key = $('.window').length;
        windows.instances[key] = application;
        application.dom.attr('data-instance', key);
        windows.desktop.append(application.dom);
        windows.focus(application);
        return application;
    },
    focus: function(target) {
        if (target === undefined) {
            windows.desktop.on('mousedown', '.window', function(e) {
                windows.focus(windows.instance($(this)));
            });
        } else {
            if (!target.dom.hasClass('focused')) {
                $('.window').removeClass('focused');
                target.dom.addClass('focused');
                windows.desktop.append(target.dom);
                if (target.hasOwnProperty('pointer')) {
                    filesystem.instance.pointer = target.pointer;
                }
                setTimeout(function() {
                    target.focus();
                }, 0);
            }
        }
    },
    draggable: function() {
        var target = null;
        var start = { x: 0, y: 0 };
        var origin = { x: 0, y: 0 };

        windows.desktop.on('mousedown', '.window header', function(e) {
            target = $(this).closest('.window');
            start = { x: e.pageX, y: e.pageY };
            origin = { x: target.offset().left, y: target.offset().top };
        });

        windows.desktop.on('mousemove', function(e) {
            if (target !== null) {
                target.css({
                    top: origin.y + (e.pageY - start.y) + 'px',
                    left: origin.x + (e.pageX - start.x) + 'px'
                });
            }
        });

        windows.desktop.on('mouseup', function() {
            target = null;
            start = { x: 0, y: 0 };
            origin = { x: 0, y: 0 };
        });

        windows.desktop.on('mousedown', '.window header .action-bar > *', function(e) {
            e.stopPropagation();
        });
    },
    close: function(target) {
        target.dom.remove();
        var last = windows.desktop.find('.window').last();
        if (last.length) {
            windows.focus(windows.instance(last));
        }
        $('.overlay').remove();
    },
    actions: function() {
        windows.desktop.on('mousedown', '.window .action', function(e) {
            e.stopPropagation();
            var target = windows.instance($(this).closest('.window'));
            windows.focus(target);
            if ($(this).hasClass('close')) {
                windows.close(target);
            } else if ($(this).hasClass('minimize')) {
                target.minimize();
            } else if ($(this).hasClass('maximize')) {
                target.maximize();
            }
        });
    },
    instance: function(target) {
        return windows.instances[target.data('instance')];
    }
};

var system = {
    clipboard: [],
    clipboard_sources: [],
    clipboard_operation: null,
    clipboard_operations: { 67: 'cp', 88: 'mv' },
    contextmenu: $('.contextmenu'),
    contextmenu_target: null,
    initialize: function() {
        $(document).on('keyup', function(e) {
            if (e.keyCode === 67 || e.keyCode === 88 || e.keyCode === 86) {
                system.invoke_clipboard(e.keyCode);
            } else if (e.keyCode === 46) {
                system.invoke_deletion();
            }
        });

        $(document).on('contextmenu', function(e) {
            e.preventDefault();
            system.invoke_contextmenu(e);
        });

        $('.contextmenu .rename').on('click', function(e) {
            var target = windows.instance(system.contextmenu_target.closest('.window'));
            target.icons_handler(e);
        });
    },
    invoke_clipboard: function(code) {
        if (code === 67 || code === 88) {
            system.clipboard = [];
            system.clipboard_operation = system.clipboard_operations[code];
            $('.window .icon.highlighted').each(function() {
                system.clipboard.push($(this).data('path'));
                var parent = windows.instance($(this).closest('.window'));
                if (system.clipboard_sources.indexOf(parent) < 0) {
                    system.clipboard_sources.push(parent);
                }
            });
        } else {
            var target = windows.instance($('.window.focused'));
            if (target && target instanceof Finder) {
                for (var i = 0; i < system.clipboard.length; i++) {
                    filesystem.instance[system.clipboard_operation](system.clipboard[i], target.pointer);
                }
                target.refresh();
                for (var i = 0; i < system.clipboard_sources.length; i++) {
                    system.clipboard_sources[i].refresh();
                }
                system.clipboard = [];
                system.clipboard_sources = [];
            }
        }
    },
    invoke_deletion: function() {
        $('.window .icon.highlighted').each(function() {
            var target = windows.instance($(this).closest('.window'));
            if ($(this).hasClass('years')) {
                filesystem.instance.rmdir($(this).data('path'));
            } else if ($(this).hasClass('sublimetext')) {
                filesystem.instance.rm($(this).data('path'));
            }
            $(this).remove();
            target.refresh();
        });
    },
    invoke_contextmenu: function(e) {
        var target = $(e.target);
        if (target.closest('.finder').length) {
            // @todo clean this up later
            system.contextmenu_target = $('.icon.highlighted');
            if (system.contextmenu_target.length) {
                system.contextmenu.css({ 'top': e.pageY + 'px', 'left': e.pageX + 'px' }).removeClass('hidden');
            }
        }
    }
};

var applications = {
    finder: function(path) {
        return new Finder(filesystem.resolve_path(path));
    },
    terminal: function(path) {
        return new Terminal(filesystem.resolve_path(path));
    },
    textedit: function(path) {
        return new TextEdit(path ? filesystem.resolve_path(path) : path);
    },
    filebrowser: function(path) {
        return new FileBrowser(filesystem.resolve_path(path));
    }
};

var templates = {
    finder: $('template#finder').html(),
    terminal: $('template#terminal').html(),
    textedit: $('template#textedit').html(),
    filebrowser: $('template#filebrowser').html(),
    alert: $('template#alert').html()
};

// UTILITY METHODS
var util = {
    autosize: function(target) {
        target.css('height', 'auto');
        target.css('height', target[0].scrollHeight + 'px');
    },
    alert: function(message) {
        $('.window').removeClass('focused');
        var template = $(templates.alert);
        var overlay = $('<div class="overlay"></div>');
        template.find('p').text(message);
        windows.desktop.append(overlay);
        windows.desktop.append(template);
        template.css({
            'top': (window.innerHeight - 3 * template.height()) / 2 + 'px',
            'left': (window.innerWidth - template.width()) / 2 + 'px'
        });

        template.find('.action').on('mousedown', function(e) {
            e.stopPropagation();
            overlay.remove();
            template.remove();
            windows.desktop.find('.window').last().addClass('focused');
        });
    }
};

// WINDOW CLASSES
function Class() {}

Class.extend = function(child) {
    var instance = new this();
    for (var property in instance) {
        if (!child.prototype.hasOwnProperty(property)) {
            child.prototype[property] = instance[property];
        }
    }
    for (var property in this) {
        if (!child.hasOwnProperty(property)) {
            child[property] = this[property];
        }
    }
};

function Window() {}
Class.extend(Window);

Window.prototype.focus = function() {};
Window.prototype.keyboard_handler = function() {};
Window.prototype.textarea_handler = function() {};
Window.prototype.icons_handler = function() {};
Window.prototype.huds_handler = function() {};

Window.prototype.minimize = function(callback) {
    if (this.dom.hasClass('maximized')) {
        this.dom.animate({
            top: this.dom.offset().top + (this.max_height - this.min_height) / 2 + 'px',
            left: this.dom.offset().left + (this.max_width - this.min_width) / 2 + 'px',
            width: this.min_width + 'px',
            height: this.min_height + 'px'
        }, 150, callback).removeClass('maximized');
    }
};

Window.prototype.maximize = function(callback) {
    if (!this.dom.hasClass('maximize')) {
        this.dom.animate({
            top: this.dom.offset().top - (this.max_height - this.min_height) / 2 + 'px',
            left: this.dom.offset().left - (this.max_width - this.min_width) / 2 + 'px',
            width: this.max_width + 'px',
            height: this.max_height + 'px'
        }, 150, callback).addClass('maximized');
    }
};

function Finder(pointer) {
    this.min_width = 700;
    this.min_height = 400;
    this.max_width = window.innerWidth - 100;
    this.max_height = window.innerHeight - 100;
    this.history = [];
    this.cursor = -1;
    this.dom = $(templates.finder);
    this.address_bar = this.dom.find('input[name="path"]');
    this.search_bar = this.dom.find('input[name="search"]');
    this.pointer = null;
    var self = this;

    this.location(pointer);
}
Window.extend(Finder);

Window.favorites = [];

Finder.prototype.maximize = function() {
    if (!this.dom.hasClass('maximize')) {
        this.dom.animate({
            top: 50 + 'px',
            left: 50 + 'px',
            width: this.max_width + 'px',
            height: this.max_height + 'px'
        }, 150).addClass('maximized');
    }
};

Finder.prototype.location = function(location) {
    this.pointer = location;
    this.history = this.history.slice(0, Math.max(this.cursor, -1) + 1);
    var last = this.history[this.history.length - 1];
    if (this.pointer !== last) {
        this.history.push(this.pointer);
        this.cursor++;
    }
    this.refresh();
};

Finder.prototype.navigate = function(direction) {
    if (direction === 'back') {
        this.pointer = this.history[--this.cursor];
    } else if (direction === 'forward') {
        this.pointer = this.history[++this.cursor];
    }
    this.refresh();
};

Finder.prototype.refresh = function() {
    this.dom.attr('data-title', 'Finder - ' + (this.pointer.key ? this.pointer.key : '/'));
    var path = filesystem.absolute_path(this.pointer);
    this.address_bar.val(path ? path : '/');
    this.dom.find('main').empty();
    this.dom.find('.favorites').empty();
    // @todo clean this up later
    this.pointer.children.sort(function(a, b) {
        if (a.type === 'directory' && b.type === 'file') {
            return -1;
        } else if (a.type === 'file' && b.type === 'directory') {
            return 1;
        }
        if (a.key < b.key) {
            return -1;
        } else if (a.key > b.key) {
            return 1;
        }
        return 0;
    });
    for (var i = 0; i < this.pointer.children.length; i++) {
        this.insert(this.pointer.children[i]);
    }
    for (var i = 0; i < Window.favorites.length; i++) {
        // @todo clean this up later
        try {
            var favorite = filesystem.resolve_path(Window.favorites[i]);
            this.dom.find('.favorites').append('<li data-path="' + Window.favorites[i] + '">' + favorite.key + '</li>');
        } catch (e) {}
    }
    this.dom.find('.action-button.folder, .action-button.file').removeClass('disabled');
    if (this.cursor === 0) {
        this.dom.find('.action-button.back').addClass('disabled');
    } else {
        this.dom.find('.action-button.back').removeClass('disabled');
    }
    if (this.cursor === this.history.length - 1) {
        this.dom.find('.action-button.forward').addClass('disabled');
    } else {
        this.dom.find('.action-button.forward').removeClass('disabled');
    }
};

Finder.prototype.insert = function(node) {
    var element = $('<div class="icon" data-path="' + filesystem.absolute_path(node) + '">' + node.key + '</div>');
    if (node.type === 'directory') {
        element.addClass('years');
    } else if (node.type === 'file') {
        element.addClass('sublimetext');
    }
    this.dom.find('main').append(element);
};

Finder.prototype.create = function(type) {
    var node = $('<div class="icon highlighted"><textarea name="node" class="autosize" data-new="true"></textarea></div>');
    node.attr('data-capture-enter', 'true');
    if (type === 'directory') {
        node.addClass('years');
    } else if (type === 'file') {
        node.addClass('sublimetext');
    }
    this.dom.find('main').append(node);
    setTimeout(function() {
        node.find('textarea').trigger('focus');
    }, 0);
};

Finder.prototype.keyboard_handler = function(e) {
    var target = $(e.target);
    if (e.keyCode === 27) {
        target.trigger('blur');
    }
};

Finder.prototype.textarea_handler = function(e) {
    var target = $(e.target);
    if (e.type === 'keydown' && target.hasClass('autosize')) {
        if (e.keyCode === 13) {
            this.dom.find('textarea').trigger('blur');
        } else {
            var self = this;
            setTimeout(function() {
                util.autosize(self.dom.find('textarea'));
            }, 0);
        }
    } else if (e.type === 'blur' || e.type === 'focusout') {
        var path = filesystem.absolute_path(this.pointer);
        if (!target.val().length) {
            target.parent().remove();
        } else if (target.attr('data-new') === 'true') {
            if (target.parent().hasClass('years')) {
                try {
                    filesystem.instance.mkdir(path + '/' + target.val());
                } catch (e) {
                    target.parent().remove();
                    util.alert(e.message);
                }
            } else if (target.parent().hasClass('sublimetext')) {
                if (this.pointer.find(target.val()).length) {
                    target.parent().remove();
                    util.alert('Name already taken: ' + target.val());
                } else {
                    filesystem.instance.cat('>', path + '/' + target.val(), '');
                }
            }
        } else {
            try {
                filesystem.instance.rn(target.attr('data-new'), target.val());
            } catch (e) {
                util.alert(e.message);
            }
        }
        this.refresh();
    }
};

Finder.prototype.icons_handler = function(e) {
    var target = $(e.target);
    if (target.hasClass('years')) {
        this.location(filesystem.resolve_path(target.data('path')));
    } else if (target.hasClass('sublimetext')) {
        var editor = windows.spawn('textedit', target.data('path'));
        editor.dom.attr('data-path', filesystem.absolute_path(editor.pointer));
    } else if (e.type === 'click') {
        system.contextmenu.addClass('hidden');
        var target = system.contextmenu_target;
        var node = filesystem.resolve_path(target.data('path'));
        target.html('<textarea name="node" class="autosize" data-new="' + filesystem.absolute_path(node) + '">' + node.key + '</textarea>');
        target.addClass('highlighted').find('textarea').trigger('focus');
    }
};

Finder.prototype.huds_handler = function(e) {
    var target = $(e.target);
    if (target.hasClass('back') && !target.hasClass('disabled')) {
        this.navigate('back');
    } else if (target.hasClass('forward') && !target.hasClass('disabled')) {
        this.navigate('forward');
    } else if (target.is('[name="path"]')) {
        try {
            var destination = filesystem.resolve_path(target.val());
            this.location(destination);
        } catch (e) {
            target.addClass('error').trigger('focus');
        }
    } else if (target.is('[name="search"]')) {
        var results = filesystem.instance.whereis(target.val());
        this.dom.find('main').empty();
        this.dom.find('.action-button.folder, .action-button.file').addClass('disabled');
        for (var i = 0; i < results.length; i++) {
            this.cursor++;
            this.dom.find('.action-bar .action-button').addClass('disabled');
            this.dom.find('.action-bar .action-button.back').removeClass('disabled');
            var node = results[i];
            var path = filesystem.absolute_path(node);
            var result = $('<div class="icon" data-path="' + path + '" title="' + path + '">' + node.key + '</div>');
            if (node.type === 'directory') {
                result.addClass('years');
            } else if (node.type === 'file') {
                result.addClass('sublimetext');
            }
            this.dom.find('main').append(result);
        }
        if (!results.length) {
            this.dom.find('main').append('<p>No results found.</p>');
        }
    } else if (target.is('.action-button.folder') && !target.hasClass('disabled')) {
        this.create('directory');
    } else if (target.is('.action-button.file') && !target.hasClass('disabled')) {
        this.create('file');
    }
};

function Terminal(pointer) {
    this.min_width = 500;
    this.min_height = 300;
    this.max_width = 800;
    this.max_height = 500;
    this.dom = $(templates.terminal);
    this.prompt = this.dom.find('.prompt span');
    this.input = this.dom.find('textarea');
    this.buffer = null;
    this.pointer = pointer;
    var self = this;

    this.intercepts = {
        ls: function(path) {
            var results = filesystem.instance.ls(path || filesystem.absolute_path(this.pointer));
            var width = 0;
            results.forEach(function(item) {
                width = Math.max(width, item.key.length);
            });
            width += 5;
            var columns = ~~(this.min_width / 7 / width);
            var line = '';
            for (var i = 0, j = columns; i < results.length; i++) {
                line += results[i].key;
                for (var k = 0; k < width - results[i].key.length; k++) {
                    line += '\u00a0';
                }
                if (--j == 0) {
                    this.log(line);
                    line = '';
                    j = columns;
                }
            }
            this.log(line);
        },
        cd: function(path) {
            this.location(filesystem.instance.cd(path));
        },
        cat: function(params) {
            params = Array.prototype.slice.call(arguments);
            if (params[0].match('^(>|>>)$') && params.length < 3) {
                params[0] = params[0] === '>>' ? '' : params[0];
                execute.call(this, params);
                params[0] = '>';
                execute.call(this, params);
                this.buffer = 'cat ' + params.join(' ');
                this.input.attr('data-capture-enter', 'false');
                this.prompt.addClass('hidden');
            } else {
                if (!params[0].match('^(>|>>)$')) {
                    params.unshift('');
                }
                execute.call(this, params);
                this.buffer = null;
                this.input.attr('data-capture-enter', 'true');
                this.prompt.removeClass('hidden');
            }

            function execute(params) {
                var output = filesystem.instance.cat.apply(filesystem.instance, params);
                if (output !== undefined) {
                    output = output.split(/\r?\n/g);
                    for (var i = 0; i < output.length; i++) {
                        this.log(output[i]);
                    }
                }
            }
        },
        edit: function(path) {
            this.intercepts.cat.apply(this, ['>>', path]);
        },
        show: function(path) {
            this.intercepts.cat.apply(this, [path]);
        },
        whereis: function(query) {
            var results = filesystem.instance.whereis(query);
            if (results.length) {
                for (var i = 0; i < results.length; i++) {
                    this.log(filesystem.absolute_path(results[i]));
                }
            } else {
                this.log('No results found: ' + query, 'red');
            }
        },
        clear: function() {
            this.dom.find('main p').remove();
        },
        exit: function() {
            windows.close(this);
        }
    };

    this.location(this.pointer);

    // make clicks on the terminal window focus on the textarea
    this.dom.on('click', this.focus.bind(this));
}
Window.extend(Terminal);

Terminal.prototype.focus = function() {
    this.dom.find('textarea').focus();
};

Terminal.prototype.minimize = function() {
    var self = this;
    Window.prototype.minimize.call(self, function() {
        util.autosize(self.input);
    });
};

Terminal.prototype.maximize = function() {
    var self = this;
    Window.prototype.maximize.call(self, function() {
        util.autosize(self.input);
    });
};

Terminal.prototype.keyboard_handler = function(e) {
    if (e.ctrlKey) {
        if (e.keyCode === 83) {
            var command = this.buffer + ' "' + this.input.val() + '"';
            this.execute(command);
        } else if (e.keyCode === 76) {
            this.intercepts.clear.apply(this);
        } else if (e.keyCode === 68) {
            this.intercepts.exit.apply(this);
        }
    }
};

Terminal.prototype.textarea_handler = function(e) {
    var target = $(e.target);
    if (e.keyCode === 13 && target.attr('data-capture-enter') === 'true') {
        this.execute();
    } else if (target.hasClass('autosize')) {
        if (e === undefined) {
            util.autosize(this.input);
        } else {
            setTimeout(util.autosize, 0, this.input);
        }
        if (this.dom.find('.contents').height() > this.dom.find('main').height()) {
            this.dom.find('.contents').addClass('overflow');
        } else {
            this.dom.find('.contents').removeClass('overflow');
        }
    }
};

Terminal.prototype.log = function(message, color) {
    message = $('<p class="' + color + '">' + message + '</p>');
    this.input.parent().before(message);
    if (this.dom.find('.contents').height() > this.dom.find('main').height()) {
        this.dom.find('.contents').addClass('overflow');
    } else {
        this.dom.find('.contents').removeClass('overflow');
    }
};

Terminal.prototype.location = function(location) {
    var self = this;
    self.pointer = location;
    self.prompt.text(filesystem.absolute_path(location));
    self.dom.attr('data-title', 'Terminal - ' +( location.key ? location.key : '/'));
    setTimeout(function() {
        self.input.css('text-indent', (self.prompt.width() / 7 + 1) * 7 - 0.5 + 'px');
    }, 0);
};

Terminal.prototype.execute = function(input) {
    input = input === undefined ? this.input.val().trim() : input;
    if (input.length) {
        var command = input;
        var params = [];
        var index = command.indexOf(' ');
        if (index >= 0) {
            var buffer = '';
            var inside = false;
            for (var i = index + 1; i < input.length; i++) {
                var character = input.charAt(i);
                if (character === ' ' && !inside) {
                    params.push(buffer.replace(/(^["']|["']$)/g, ''));
                    buffer = '';
                    continue;
                } else if (character === '"' || character === '\'') {
                    inside = !inside;
                }
                buffer += character;
            }
            params.push(buffer.replace(/(^["']|["']$)/g, ''));
            command = input.substring(0, index);
        }
        if (this.buffer === null) {
            this.log(this.prompt.text() + ' $ ' + input);
        } else {
            var buffer = this.input.val().split(/\r?\n/g);
            for (var i = 0; i < buffer.length; i++) {
                this.log(buffer[i]);
            }
        }
        this.input.val('');
        try {
            if (this.intercepts.hasOwnProperty(command)) {
                this.intercepts[command].apply(this, params);
            } else if (filesystem.instance.hasOwnProperty(command)) {
                filesystem.instance[command].apply(filesystem.instance, params);
            } else {
                throw new Error('Command not found: ' + command);
            }
        } catch (e) {
            this.log(e.message, 'red');
        }
    } else {
        this.log(this.prompt.text() + ' $');
    }
};

function TextEdit(pointer) {
    this.min_width = 400;
    this.min_height = 300;
    this.max_width = 450;
    this.max_height = 550;
    this.dom = $(templates.textedit);
    this.pointer = null;

    if (pointer !== undefined) {
        this.open(pointer);
    }
}
Window.extend(TextEdit);

TextEdit.prototype.focus = function() {
    this.dom.find('textarea').focus();
};

TextEdit.prototype.open = function(file) {
    file = typeof file === 'object' ? file : filesystem.resolve_path(file);
    this.pointer = file;
    this.dom.attr('data-title', 'TextEdit - ' + file.key);
    this.dom.find('textarea').val(file.contents);
};

TextEdit.prototype.save = function() {
    var path = this.dom.data('path');
    try {
        var node = filesystem.resolve_path(path);
        node.contents = this.dom.find('textarea').val();
    } catch (e) {
        filesystem.instance.cat('>', path, this.dom.find('textarea').val());
    }
    this.open(path);
};

TextEdit.prototype.keyboard_handler = function(e) {
    var target = $(e.target);
    if (e.ctrlKey && e.keyCode === 83) {
        e.preventDefault();
        if (this.pointer === null) {
            windows.desktop.append('<div class="overlay"></div>');
            var filebrowser = windows.spawn('filebrowser');
            filebrowser.target(this);
        } else {
            this.dom.attr('data-path', filesystem.absolute_path(this.pointer));
            this.save();
        }
    }
};

function FileBrowser(pointer) {
    this.dom = $(templates.filebrowser);
    this.application = null;
    this.pointer = null;

    this.location(pointer);
}
Window.extend(FileBrowser);

FileBrowser.prototype.focus = function(e) {
    this.dom.find('input').trigger('focus');
};

FileBrowser.prototype.location = function(location) {
    this.pointer = location;
    var list = this.dom.find('ul').empty();
    if (this.pointer.parent !== null) {
        var path = filesystem.absolute_path(this.pointer.parent);
        list.append('<div class="icon list" data-path="' + (path.length ? path : '/') + '">(up one directory)</div>');
    }
    for (var i = 0; i < this.pointer.children.length; i++) {
        var child = this.pointer.children[i];
        if (child.type === 'directory') {
            list.append('<div class="icon list" data-path="' + filesystem.absolute_path(child) + '">' + child.key + '</div>');
        }
    }
};

FileBrowser.prototype.target = function(application) {
    this.application = application;
    this.dom.css({
        'top': this.application.dom.offset().top + (this.application.dom.height() - this.dom.height()) / 2 + 'px',
        'left': this.application.dom.offset().left + (this.application.dom.width() - this.dom.width()) / 2 + 'px'
    });
};

FileBrowser.prototype.icons_handler = function(e) {
    var target = $(e.target);
    this.location(filesystem.resolve_path(target.data('path')));
};

FileBrowser.prototype.huds_handler = function(e) {
    e.stopPropagation();
    var input = this.dom.find('input');
    var filename = input.val().trim();
    if (!filename.length) {
        util.alert('Please enter a name for the file.');
    } else if (this.pointer.find(filename).length) {
        util.alert('Name already taken: ' + filename);
    } else {
        this.application.dom.attr('data-path', filesystem.absolute_path(this.pointer) + '/' + filename);
        this.application.save();
        windows.close(this);
    }
};
