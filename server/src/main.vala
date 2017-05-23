using Soup;
using Json;
using Vala;
using Gee;

public class Service : Server {

    public bool needs_update { get; set; }

    private CodeContext code_context { get; set; }

    private JsonReport report { get; set; default = new JsonReport (); }

    private Gee.HashMap<int, Symbol> last_symbols { get; set; }

    Gee.HashSet<string> files = new Gee.HashSet<string> ();
    Gee.HashSet<string> pkgs = new Gee.HashSet<string> ();

    public Service (int port = 8808) {
        GLib.Object (port: port);
        assert (this != null);
        this.add_handler ("/ast", ast_handler);
        this.add_handler ("/refresh", refresh_handler);
        this.add_handler ("/options", options_handler);
        this.add_handler ("/errors", errors_handler);
        this.add_handler ("/symbol", symbol_handler);
        this.init_context ();
        this.notify["needs-update"].connect(() => {
            if (this.needs_update) {
                print ("[[UPDATED]]\n");
            }
        });
    }

    public static void ast_handler (Server _serv, Soup.Message msg, string path, HashTable<string, string>? query, ClientContext ctx) {
        var serv = (Service)_serv;
        if (serv.needs_update) {
            serv.init_context ();
        }
        msg.set_response ("application/json", Soup.MemoryUse.COPY, serv.get_ast ().data);
        msg.set_status (200);
    }

    public static void refresh_handler (Server _serv, Soup.Message msg, string path, HashTable<string, string>? query, ClientContext ctx) {
        var serv = (Service)_serv;
        serv.needs_update = true;
        msg.set_response ("application/json", Soup.MemoryUse.COPY, "{ \"status\": \"ok\" }".data);
        msg.set_status (200);
    }

    public static void options_handler (Server _serv, Soup.Message msg, string path, HashTable<string, string>? query, ClientContext ctx) {
        var serv = (Service)_serv;
        var parser = new Json.Parser ();
        parser.load_from_data ((string)msg.request_body.data);

        serv.files = new Gee.HashSet<string> ();
        parser.get_root ().get_object ().get_array_member ("files").foreach_element ((arr, i, elt) => {
            serv.files.add (elt.get_string ());
        });

        serv.pkgs = new Gee.HashSet<string> ();
        parser.get_root ().get_object ().get_array_member ("packages").foreach_element ((arr, i, elt) => {
            serv.pkgs.add (elt.get_string ());
        });

        serv.needs_update = true;
        msg.set_response ("application/json", Soup.MemoryUse.COPY, "{ \"status\": \"ok\" }".data);
        msg.set_status (200);
    }

    public static void errors_handler (Server _serv, Soup.Message msg, string path, HashTable<string, string>? query, ClientContext ctx) {
        var serv = (Service)_serv;
        if (serv.needs_update) {
            serv.init_context ();
        }
        msg.set_response ("application/json", Soup.MemoryUse.COPY, serv.get_errors ().data);
        msg.set_status (200);
    }

    public static void symbol_handler (Server _serv, Soup.Message msg, string path, HashTable<string, string>? query, ClientContext ctx) {
        var serv = (Service)_serv;
        var parser = new Json.Parser ();
        parser.load_from_data ((string)msg.request_body.data);

        var symbol_id = parser.get_root ().get_object ().get_int_member ("id");
        var ast = new JsonAST ();
        serv.last_symbols[(int)symbol_id].accept (ast);
        serv.last_symbols = ast.symbols;

        msg.set_response ("application/json", Soup.MemoryUse.COPY, ast.result.data);
        msg.set_status (200);
    }

    public string get_ast () {
        var ast = new JsonAST ();
        code_context.root.accept (ast);
        last_symbols = ast.symbols;
        return ast.result;
    }

    public string get_errors () {
        var root = new Json.Object ();
        var errs = new Json.Array ();
        var warns = new Json.Array ();
        foreach (var message in report.messages) {
            switch (message.kind) {
                case "error":
                    errs.add_object_element (message.to_json ());
                    break;
                case "warning":
                    warns.add_object_element (message.to_json ());
                    break;
                default:
                    print (@"Unhandled report type: $(message.kind)\n");
                    break;
            }
        }
        root.set_array_member ("errors", errs);
        root.set_array_member ("warnings", warns);
        var root_node = new Json.Node (NodeType.OBJECT);
        root_node.set_object (root);
        var gen = new Generator () {
            root = root_node
        };
        return gen.to_data (null);
    }

    public int init_context () {
        if (files.size == 0) {
            return 42;
        }
        string[] sources = files.to_array ();
        string[] packages = pkgs.to_array ();
        string[] defines = {};
        bool nostdpkg = true;
        string gir = null;
        string library = null;
        bool fatal_warnings = false;
        string output = null;
        bool ccode_only = false;
        string[] fast_vapis = {};
        string fast_vapi_filename = null;
        string[] gresources = {};
        string directory = null;
        string shared_library = null;
        string internal_vapi_filename = null;
        string internal_header_filename = null;
        string header_filename = null;

        this.code_context = new CodeContext ();
        this.report.clear ();
        this.code_context.report = this.report;
    	CodeContext.push (this.code_context);
    	this.code_context.report.set_colors ("error=01;31:warning=01;35:note=01;36:caret=01;32:locus=01:quote=01");

    	// default to build executable
    	if (output == null) {
    		// strip extension if there is one
    		// else we use the default output file of the C compiler
    		if (sources[0].last_index_of_char ('.') != -1) {
    			int dot = sources[0].last_index_of_char ('.');
    			output = GLib.Path.get_basename (sources[0].substring (0, dot));
    		}
    	}

    	this.code_context.assert = true;
    	this.code_context.checking = true;
    	this.code_context.deprecated = true;
    	this.code_context.since_check = true;
    	this.code_context.hide_internal = false;
    	this.code_context.experimental = false;
    	this.code_context.experimental_non_null = false;
    	this.code_context.gobject_tracing = false;
    	this.code_context.report.enable_warnings = true;
    	this.code_context.version_header = true;

        this.code_context.basedir = CodeContext.realpath (".");
        this.code_context.directory = this.code_context.basedir;
    	this.code_context.vapi_directories = {};
    	this.code_context.vapi_comments = true;
    	this.code_context.gir_directories = {};
    	this.code_context.metadata_directories = {};
    	this.code_context.debug = false;
    	this.code_context.mem_profiler = false;
    	this.code_context.save_temps = false;

    	this.code_context.profile = Profile.GOBJECT;
    	this.code_context.add_define ("GOBJECT");
    	nostdpkg |= fast_vapi_filename != null;
    	this.code_context.nostdpkg = nostdpkg;

    	if (defines != null) {
    		foreach (string define in defines) {
    			this.code_context.add_define (define);
    		}
    	}

    	for (int i = 2; i <= 36; i += 2) {
    		this.code_context.add_define ("VALA_0_%d".printf (i));
    	}

    	this.code_context.target_glib_major = 2;
    	this.code_context.target_glib_minor = 32;
    	for (int i = 16; i <= this.code_context.target_glib_minor; i += 2) {
    		this.code_context.add_define ("GLIB_2_%d".printf (i));
    	}

    	if (pkgs.size > 0) {
    		foreach (string package in pkgs) {
    			this.code_context.add_external_package (package);
    		}
    	}

    	if (fast_vapis != null) {
    		foreach (string vapi in fast_vapis) {
    			var rpath = CodeContext.realpath (vapi);
    			var source_file = new SourceFile (this.code_context, SourceFileType.FAST, rpath);
    			this.code_context.add_source_file (source_file);
    		}
    		this.code_context.use_fast_vapi = true;
    	}

    	this.code_context.gresources = gresources;

    	if (this.code_context.report.get_errors () > 0 || (fatal_warnings && this.code_context.report.get_warnings () > 0)) {
            print (this.get_errors ());
            return 2;
    	}

    	this.code_context.codegen = new GDBusServerModule ();

    	bool has_c_files = false;
    	bool has_h_files = false;

    	foreach (string source in sources) {
    		if (this.code_context.add_source_filename (source, false, true)) {
    			if (source.has_suffix (".c")) {
    				has_c_files = true;
    			} else if (source.has_suffix (".h")) {
    				has_h_files = true;
    			}
    		}
    	}

    	if (this.code_context.report.get_errors () > 0 || (fatal_warnings && this.code_context.report.get_warnings () > 0)) {
    		return 1;
    	}

    	new Vala.Parser ().parse (this.code_context);
    	new Genie.Parser ().parse (this.code_context);
    	new GirParser ().parse (this.code_context);

    	if (this.code_context.report.get_errors () > 0 || (fatal_warnings && this.code_context.report.get_warnings () > 0)) {
    		return exit ();
    	}

    	this.code_context.check ();

    	if (this.code_context.report.get_errors () > 0 || (fatal_warnings && this.code_context.report.get_warnings () > 0)) {
    		return 7;
    	}

    	if (library == null) {
    		// building program, require entry point
    		if (!has_c_files && this.code_context.entry_point == null) {
    			Report.error (null, "program does not contain a static `main' method");
    		}
    	}

    	if (this.code_context.report.get_errors () > 0 || (fatal_warnings && this.code_context.report.get_warnings () > 0)) {
    		return 5;
    	}

        this.needs_update = false;
        return 0;
    }

    private int exit () {
		if (this.code_context.report.get_errors () == 0 && this.code_context.report.get_warnings () == 0) {
			return 0;
		}
		if (this.code_context.report.get_errors () == 0) {
			return 0;
		} else {
			return 1;
		}
    }
}

void main (string[] args) {
    Service serv = new Service (int.parse(args[1]));
    print ("Vala service now running\n");
    serv.run ();
}
