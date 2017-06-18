/**
* The Valhalla server, handling requests and managing the {@link Vala.CodeContext}
*/
public class Valhalla.Service : Soup.Server {

    /**
    * When the server needs update, the code context will be refreshed before doing anything.
    */
    public bool needs_update { get; set; }

    /**
    * The code context of the project handled by the server.
    */
    private Vala.CodeContext code_context { get; set; }

    /**
    * Serialize errors and warnings as JSON.
    */
    private JsonReport report { get; set; default = new JsonReport (); }

    /**
    * The last symbol map (which is the valid one).
    *
    * @see Valhalla.JsonAST.symbols
    */
    private Gee.HashMap<int, Vala.Symbol> last_symbols { get; set; }

    Gee.HashSet<string> files = new Gee.HashSet<string> ();
    Gee.HashSet<string> pkgs = new Gee.HashSet<string> ();

    public Service (int port = 8808) {
        GLib.Object (port: port);
        assert (this != null);
        add_handler ("/ast", ast_handler);
        add_handler ("/refresh", refresh_handler);
        add_handler ("/options", options_handler);
        add_handler ("/errors", errors_handler);
        add_handler ("/symbol", symbol_handler);
        init_context ();
        notify["needs-update"].connect(() => {
            if (needs_update) {
                print ("[[UPDATED]]\n");
            }
        });
    }

    /**
    * Serves the JSON AST
    */
    public static void ast_handler (Soup.Server _serv, Soup.Message msg) {
        var serv = (Service)_serv;
        if (serv.needs_update) {
            serv.init_context ();
        }
        msg.set_response ("application/json", Soup.MemoryUse.COPY, serv.get_ast ().data);
        msg.set_status (200);
    }

    /**
    * Force refreshing the code context
    */
    public static void refresh_handler (Soup.Server _serv, Soup.Message msg) {
        var serv = (Service)_serv;
        serv.needs_update = true;
        msg.set_response ("application/json", Soup.MemoryUse.COPY, "{ \"status\": \"ok\" }".data);
        msg.set_status (200);
    }

    /**
    * Set some options for the project
    */
    public static void options_handler (Soup.Server _serv, Soup.Message msg) {
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

    /**
    * Serves the errors and warnings as JSON
    */
    public static void errors_handler (Soup.Server _serv, Soup.Message msg) {
        var serv = (Service)_serv;
        if (serv.needs_update) {
            serv.init_context ();
        }
        msg.set_response ("application/json", Soup.MemoryUse.COPY, serv.get_errors ().data);
        msg.set_status (200);
    }

    /**
    * Gives details about a symbol stored in the symbols table.
    */
    public static void symbol_handler (Soup.Server _serv, Soup.Message msg) {
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

    /**
    * Generates an AST for
    */
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
        var root_node = new Json.Node (Json.NodeType.OBJECT);
        root_node.set_object (root);
        var gen = new Json.Generator () {
            root = root_node
        };
        return gen.to_data (null);
    }

    public void init_context () {
        if (files.size == 0) {
            return;
        }
        string[] sources = files.to_array ();
        string[] defines = {};
        bool nostdpkg = true;
        string library = null;
        bool fatal_warnings = false;
        string output = null;
        string[] fast_vapis = {};
        string fast_vapi_filename = null;
        string[] gresources = {};

        code_context = new Vala.CodeContext ();
        report.clear ();
        code_context.report = report;
    	Vala.CodeContext.push (code_context);

    	// default to build executable
    	if (output == null) {
    		// strip extension if there is one
    		// else we use the default output file of the C compiler
    		if (sources[0].last_index_of_char ('.') != -1) {
    			int dot = sources[0].last_index_of_char ('.');
    			output = Path.get_basename (sources[0].substring (0, dot));
    		}
    	}

    	code_context.assert = true;
    	code_context.checking = true;
    	code_context.deprecated = true;
    	code_context.since_check = true;
    	code_context.hide_internal = false;
    	code_context.experimental = false;
    	code_context.experimental_non_null = false;
    	code_context.gobject_tracing = false;
    	code_context.report.enable_warnings = true;
    	code_context.version_header = true;

        code_context.basedir = Vala.CodeContext.realpath (".");
        code_context.directory = code_context.basedir;
    	code_context.vapi_directories = {};
    	code_context.vapi_comments = true;
    	code_context.gir_directories = {};
    	code_context.metadata_directories = {};
    	code_context.debug = false;
    	code_context.mem_profiler = false;
    	code_context.save_temps = false;

    	code_context.profile = Vala.Profile.GOBJECT;
    	code_context.add_define ("GOBJECT");
    	nostdpkg |= fast_vapi_filename != null;
    	code_context.nostdpkg = nostdpkg;

		foreach (string define in defines) {
			code_context.add_define (define);
		}

    	for (int i = 2; i <= 36; i += 2) {
    		code_context.add_define (@"VALA_0_$i");
    	}

    	code_context.target_glib_major = 2;
    	code_context.target_glib_minor = 32;
    	for (int i = 16; i <= code_context.target_glib_minor; i += 2) {
    		code_context.add_define (@"GLIB_2_$i");
    	}

    	if (pkgs.size > 0) {
    		foreach (string package in pkgs) {
    			code_context.add_external_package (package);
    		}
    	}

    	if (fast_vapis != null) {
    		foreach (string vapi in fast_vapis) {
    			var rpath = Vala.CodeContext.realpath (vapi);
    			var source_file = new Vala.SourceFile (code_context, Vala.SourceFileType.FAST, rpath);
    			code_context.add_source_file (source_file);
    		}
    		code_context.use_fast_vapi = true;
    	}

    	code_context.gresources = gresources;

    	if (code_context.report.get_errors () > 0 || (fatal_warnings && code_context.report.get_warnings () > 0)) {
            return;
    	}

    	code_context.codegen = new Vala.GDBusServerModule ();

    	bool has_c_files = false;
    	bool has_h_files = false;

    	foreach (string source in sources) {
    		if (code_context.add_source_filename (source, false, true)) {
    			if (source.has_suffix (".c")) {
    				has_c_files = true;
    			} else if (source.has_suffix (".h")) {
    				has_h_files = true;
    			}
    		}
    	}

    	if (code_context.report.get_errors () > 0 || (fatal_warnings && code_context.report.get_warnings () > 0)) {
    		return;
    	}

    	new Vala.Parser ().parse (code_context);
    	new Vala.Genie.Parser ().parse (code_context);
    	new Vala.GirParser ().parse (code_context);

    	if (code_context.report.get_errors () > 0 || (fatal_warnings && code_context.report.get_warnings () > 0)) {
    		return;
    	}

    	code_context.check ();

    	if (code_context.report.get_errors () > 0 || (fatal_warnings && code_context.report.get_warnings () > 0)) {
            return;
    	}

    	if (library == null) {
    		// building program, require entry point
    		if (!has_c_files && code_context.entry_point == null) {
    			Vala.Report.error (null, "program does not contain a static `main' method");
                return;
    		}
    	}

        needs_update = false;
    }
}

void main (string[] args) {
    var serv = new Valhalla.Service (int.parse(args[1]));
    print ("Vala service now running\n");
    serv.run ();
}
