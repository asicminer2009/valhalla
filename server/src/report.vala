using Json;
using Vala;

public struct ReportMessage {
    string kind;
    string message;
    SourceReference reference;

    public Json.Object to_json () {
        var obj = new Json.Object ();
        obj.set_string_member ("message", this.message);

        var begin = new Json.Object ();
        begin.set_int_member ("line", this.reference.begin.line);
        begin.set_int_member ("column", this.reference.begin.column);

        var end = new Json.Object ();
        end.set_int_member ("line", this.reference.end.line);
        end.set_int_member ("column", this.reference.end.column);

        var location = new Json.Object ();
        location.set_string_member ("file", this.reference.file.filename);
        location.set_object_member ("begin", begin);
        location.set_object_member ("end", end);

        obj.set_object_member ("location", location);
        return obj;
    }
}

public class JsonReport : Report {

    public ArrayList<ReportMessage?> messages { get; set; default = new ArrayList<ReportMessage?> (); }

    public override void depr (SourceReference? source, string message) {
        messages.add ({ "deprecation", message, source });
        updated ();
    }
    public override void err (SourceReference? source, string message) {
        errors++;
        messages.add ({ "error", message, source });
        updated ();
    }
    public override void note (SourceReference? source, string message) {
        messages.add ({ "note", message, source });
        updated ();
    }
    public override void warn (SourceReference? source, string message) {
        warnings++;
        messages.add ({ "warning", message, source });
        updated ();
    }

    public void clear () {
        messages.clear ();
        errors = 0;
        warnings = 0;
        updated ();
    }

    public signal void updated ();
}
