/**
* Generate a JSON representation of a Vala AST.
*/
public class Valhalla.JsonAST : Vala.CodeVisitor {
    /**
    * The root of the AST
    */
    private Json.Object ast { get; set; default = new Json.Object (); }

    /**
    * A JSON array where will be stored the children of the last parent node which has been visited.
    *
    * When a node with children have been visited, it calls the {@link Valhalla.JsonAST.children} methods,
    * which defines this node as the current node (this property correspond to the `children` array of the JSON node)
    *
    * Then, it visit childrens, who will add themselves to this array.
    */
    private Json.Array current { get; set; }

    /**
    * We store the symbols in a table. Then, to define the type of something like a variable, we give its ID
    * in this table, and the client request more details if needed.
    */
    public Gee.HashMap<int, Vala.Symbol> symbols { get; set; default = new Gee.HashMap<int, Vala.Symbol> (); }
    int last_symbol_id = 0;

    public JsonAST () {
        ast.set_array_member ("children", new Json.Array ());
        ast.set_array_member ("usings", new Json.Array ());
        current = ast.get_array_member("children");
    }

    /**
    * Get a JSON representation of the AST
    */
    public string result {
        owned get {
            var root = new Json.Node (Json.NodeType.OBJECT);
            root.set_object (this.ast);
            var gen = new Json.Generator () {
                root = root
            };
            return gen.to_data (null);
        }
    }

    /**
    * Add 'children' property to a JSON object and fill it with the child nodes of a code node.
    *
    * @param node The parent code node.
    * @param obj  The JSON object representing the parent code node.
    */
    private void children (Vala.CodeNode node, Json.Object obj) {
        // save it to restore it after
        // at this time, `current` is the parent node of `node`
        var old_current = current;

        current = new Json.Array ();
        obj.set_array_member ("children", current);

        // visit children (they add themselves to `current` when visited)
        node.accept_children (this);

        // restore `current` and add the `children` array
        current = old_current;
        current.add_object_element (obj);
    }

    /**
    * Creates a new JSON object representing an AST node, with a few common properties.
    *
    * @param code_node The code node to transform to JSON
    * @param type      The type of the code node (simpler than having `if (code_node is X)` 42 times)
    */
    private Json.Object create_node (Vala.CodeNode code_node, string type) {
        var node = new Json.Object ();
        node.set_string_member ("type", type);

        // We store the location of this code node if possible
        if (code_node.source_reference != null) {
            var loc = new Json.Object ();
            loc.set_string_member ("file", code_node.source_reference.file.filename);
            if (code_node.source_reference.file.file_type == Vala.SourceFileType.PACKAGE) {
                loc.set_string_member ("package", code_node.source_reference.file.package_name);
            }

            var begin = new Json.Object ();
            begin.set_int_member ("line", code_node.source_reference.begin.line);
            begin.set_int_member ("column", code_node.source_reference.begin.column);

            var end = new Json.Object ();
            end.set_int_member ("line", code_node.source_reference.end.line);
            end.set_int_member ("column", code_node.source_reference.end.column);

            loc.set_object_member ("begin", begin);
            loc.set_object_member ("end", end);

            node.set_object_member ("location", loc);
        }

        // We also store the documentation comments
        if (code_node is Vala.Symbol) {
            var symb = (Vala.Symbol)code_node;
            if (symb.comment != null) {
                node.set_string_member ("comment", symb.comment.content);
            }
        }
        return node;
    }

    /**
    * Serialize the parameters of a method (and store them as variables too).
    */
    private void parameters (Vala.Method m, Json.Object meth) {
        var params = new Json.Array ();
        var vars = new Json.Array ();
        foreach (var param in m.get_parameters ()) {
            var param_json = new Json.Object ();
            param_json.set_string_member ("name", param.name);
            param_json.set_string_member ("direction", param.direction == Vala.ParameterDirection.OUT ?
                                                        "out" : param.direction == Vala.ParameterDirection.REF ?
                                                            "ref" : "");
            params.add_object_element (param_json);

            // add it to the variables list
            var json_var = create_node (param, "variable");
            json_var.set_string_member ("name", param.name);
            json_var.set_string_member ("dataType", param.variable_type.to_string ());
            json_var.set_int_member ("symbolId", last_symbol_id);
            symbols[last_symbol_id] = param.variable_type.data_type;
            last_symbol_id++;
            vars.add_object_element (json_var);
        }
        meth.set_array_member ("variables", vars);
        meth.set_array_member ("parameters", params);
    }

    // All the following methods visit a specific type of code node and serialize it as JSON.

    public override void visit_class (Vala.Class cl) {
		var cls = create_node (cl, "class");
        cls.set_string_member ("name", cl.name);
        cls.set_string_member ("qualifiedName", cl.get_full_name ());

        if (cl.base_class != null) {
            cls.set_int_member ("parentId", last_symbol_id);
            symbols[last_symbol_id] = cl.base_class;
            last_symbol_id++;
        }

        children (cl, cls);
	}

    public override void visit_constant (Vala.Constant c) {
        var cst = create_node (c, "constant");
        cst.set_string_member ("name", c.name);
        cst.set_string_member ("qualifiedName", c.get_full_name ());
        current.add_object_element (cst);
    }

    public override void visit_constructor (Vala.Constructor c) {
        var ctor = create_node (c, "constructor");
        ctor.set_string_member ("name", c.name);
        ctor.set_string_member ("qualifiedName", c.get_full_name ());
        children (c, ctor);
	}

    public override void visit_creation_method (Vala.CreationMethod m) {
        var meth = create_node (m, "creation-method");

        if (m.name == ".new") {
			meth.set_string_member ("name", m.parent_symbol.name);
		} else {
			meth.set_string_member ("name", m.parent_symbol.name + "." + m.name);
		}

        meth.set_string_member ("qualifiedName", m.get_full_name ());
        parameters (m, meth);
        children (m, meth);
	}

    public override void visit_enum (Vala.Enum en) {
    	var enm = create_node (en, "enum");
        enm.set_string_member ("name", en.name);
        enm.set_string_member ("qualifiedName", en.get_full_name ());
        current.add_object_element (enm);
        children (en, enm);
	}

    public override void visit_enum_value (Vala.EnumValue ev) {
        var enm = create_node (ev, "enum-value");
        enm.set_string_member ("name", ev.name);
        enm.set_string_member ("qualifiedName", ev.get_full_name ());
        current.add_object_element (enm);
	}

    public override void visit_block (Vala.Block bl) {
        var json = create_node (bl, "block");
        var vars = new Json.Array ();
        foreach (var variable in bl.get_local_variables ()) {
            var json_var = create_node (variable, "variable");
            json_var.set_string_member ("name", variable.name);
            json_var.set_string_member ("dataType", variable.variable_type.to_string ());
            json_var.set_int_member ("symbolId", last_symbol_id);
            symbols[last_symbol_id] = variable.variable_type.data_type;
            last_symbol_id++;
            vars.add_object_element (json_var);
        }
        json.set_array_member ("variables", vars);
        children (bl, json);
    }

    public override void visit_error_code (Vala.ErrorCode ecode) {
    	return;
	}

    public override void visit_error_domain (Vala.ErrorDomain edomain) {
    	return;
	}

    public override void visit_field (Vala.Field f) {
		var fld = create_node (f, "field");
        fld.set_string_member ("name", f.name);
        fld.set_string_member ("qualifiedName", f.get_full_name ());
        current.add_object_element (fld);
	}

    public override void visit_interface (Vala.Interface iface) {
        var iface_json = create_node (iface, "class");
        iface_json.set_string_member ("name", iface.name);
        iface_json.set_string_member ("qualifiedName", iface.get_full_name ());

        children (iface, iface_json);
	}

    public override void visit_method (Vala.Method m) {
        var meth = create_node (m, "method");
        meth.set_string_member ("name", m.name);
        meth.set_string_member ("qualifiedName", m.get_full_name ());
        meth.set_string_member ("returnType", m.return_type.to_string ());
        meth.set_boolean_member ("isStatic", m.binding == Vala.MemberBinding.STATIC || m.parent_symbol is Vala.Namespace);

        parameters (m, meth);

        children (m, meth);
	}

    public override void visit_namespace (Vala.Namespace ns) {
        var n = create_node (ns, "namespace");
        n.set_string_member ("name", ns.name);
        n.set_string_member ("qualifiedName", ns.get_full_name ());
        children (ns, n);
	}

    public override void visit_property (Vala.Property prop) {
        var pr = create_node (prop, "property");
        pr.set_string_member ("name", prop.name);
        pr.set_string_member ("qualifiedName", prop.get_full_name ());
        pr.set_string_member ("returnType", prop.property_type.to_string ());
        pr.set_boolean_member ("isStatic", prop.binding == Vala.MemberBinding.STATIC || prop.parent_symbol is Vala.Namespace);
        current.add_object_element (pr);
	}

    public override void visit_property_accessor (Vala.PropertyAccessor acc) {
		return;
	}

    public override void visit_signal (Vala.Signal sig) {
		var sgn = create_node (sig, "signal");
        sgn.set_string_member ("name", sig.name);
        sgn.set_string_member ("qualifiedName", sig.get_full_name ());
        sgn.set_string_member ("returnType", sig.return_type.to_string ());
        current.add_object_element (sgn);
	}

    public override void visit_source_file (Vala.SourceFile source_file) {
        ast.set_string_member ("path", source_file.filename);
        ast.set_array_member ("children", new Json.Array ());
        current = ast.get_array_member("children");
        source_file.accept_children (this);
	}

    public override void visit_struct (Vala.Struct st) {
		var s = create_node (st, "struct");
        s.set_string_member ("name", st.name);
        s.set_string_member ("qualifiedName", st.get_full_name ());
        children (st, s);
	}

    public override void visit_using_directive (Vala.UsingDirective ns) {
        var usn = new Json.Object ();
        usn.set_string_member ("type", "using");
        usn.set_string_member ("name", ns.namespace_symbol.name);
        if (ns.source_reference != null) {
            usn.set_string_member ("file", ns.source_reference.file.filename);
        }

        usn.set_boolean_member ("ignore", true);
        ast.get_array_member ("usings").add_object_element (usn);
	}

    // usefull?
    public override void visit_initializer_list (Vala.InitializerList list) {
		list.accept_children (this);
	}

	public override void visit_expression_statement (Vala.ExpressionStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_if_statement (Vala.IfStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_switch_statement (Vala.SwitchStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_switch_section (Vala.SwitchSection section) {
		section.accept_children (this);
	}

	public override void visit_switch_label (Vala.SwitchLabel label) {
		label.accept_children (this);
	}

	public override void visit_loop (Vala.Loop stmt) {
		stmt.accept_children (this);
	}

	public override void visit_while_statement (Vala.WhileStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_do_statement (Vala.DoStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_for_statement (Vala.ForStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_foreach_statement (Vala.ForeachStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_return_statement (Vala.ReturnStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_yield_statement (Vala.YieldStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_throw_statement (Vala.ThrowStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_try_statement (Vala.TryStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_delete_statement (Vala.DeleteStatement stmt) {
		stmt.accept_children (this);
	}

	public override void visit_catch_clause (Vala.CatchClause clause) {
		clause.accept_children (this);
	}

	public override void visit_array_creation_expression (Vala.ArrayCreationExpression e) {
		e.accept_children (this);
	}

	public override void visit_template (Vala.Template tmpl) {
		tmpl.accept_children (this);
	}

	public override void visit_tuple (Vala.Tuple tuple) {
		tuple.accept_children (this);
	}

	public override void visit_member_access (Vala.MemberAccess expr) {
		expr.accept_children (this);
	}

	public override void visit_method_call (Vala.MethodCall expr) {
		expr.accept_children (this);
	}

	public override void visit_element_access (Vala.ElementAccess expr) {
		expr.accept_children (this);
	}

	public override void visit_slice_expression (Vala.SliceExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_postfix_expression (Vala.PostfixExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_object_creation_expression (Vala.ObjectCreationExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_sizeof_expression (Vala.SizeofExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_typeof_expression (Vala.TypeofExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_unary_expression (Vala.UnaryExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_cast_expression (Vala.CastExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_named_argument (Vala.NamedArgument expr) {
		expr.accept_children (this);
	}

	public override void visit_addressof_expression (Vala.AddressofExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_reference_transfer_expression (Vala.ReferenceTransferExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_binary_expression (Vala.BinaryExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_type_check (Vala.TypeCheck expr) {
		expr.accept_children (this);
	}

	public override void visit_conditional_expression (Vala.ConditionalExpression expr) {
		expr.accept_children (this);
	}

	public override void visit_lambda_expression (Vala.LambdaExpression l) {
		l.accept_children (this);
	}

	public override void visit_assignment (Vala.Assignment a) {
		a.accept_children (this);
    }
}
